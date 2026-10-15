import { describe, it, expect, vi, afterEach } from 'vitest';
import { NoteWriter } from './note-writer';
import type { NotePort } from './api/ports';
import type { NoteDto, NoteInput } from '@edutube/contracts';
const recorded = (text: string, version: number): NoteDto => ({
  id: 'note-1',
  courseId: 'thales',
  lessonId: 'thales-1',
  text,
  version,
  createdAt: '2026-10-14T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
});
function setup(save: NotePort['save']) {
  const status = vi.fn();
  const saved = vi.fn();
  const port: NotePort = {
    save,
    get: async () => null,
    list: async () => ({
      items: [],
      pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
    }),
  };
  const writer = new NoteWriter(port, { status, saved }, 100);
  writer.restore('thales-1', null);
  return { writer, status, saved };
}
afterEach(() => {
  vi.useRealTimers();
});
describe('Enregistrement des notes', () => {
  it('attend la fin de la frappe et transmet le dernier texte', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (_id: string, input: NoteInput) => recorded(input.text, 1));
    const { writer } = setup(save);
    writer.change('thales-1', 'Un');
    writer.change('thales-1', 'Une idée');
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual({ text: 'Une idée', expectedVersion: null });
    expect(writer.hasPending()).toBe(false);
    writer.dispose();
  });
  it('sérialise les textes et utilise la version renvoyée par le serveur', async () => {
    let resolveFirst!: (note: NoteDto) => void;
    const save = vi
      .fn<NotePort['save']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementation(async (_id, input) => recorded(input.text, 2));
    const { writer } = setup(save);
    writer.change('thales-1', 'Première version');
    const running = writer.flush('thales-1');
    await Promise.resolve();
    writer.change('thales-1', 'Dernière version');
    resolveFirst(recorded('Première version', 1));
    await running;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1]).toEqual({ text: 'Dernière version', expectedVersion: 1 });
    writer.dispose();
  });
  it('conserve le brouillon après un conflit et attend une décision explicite', async () => {
    const save = vi
      .fn<NotePort['save']>()
      .mockRejectedValueOnce(
        Object.assign(new Error('Modification ailleurs'), { code: 'REVISION_CONFLICT' }),
      )
      .mockImplementation(async (_id, input) => recorded(input.text, 4));
    const { writer, status } = setup(save);
    writer.restore('thales-1', recorded('Texte initial', 1));
    writer.change('thales-1', 'Mon texte');
    await expect(writer.flush('thales-1')).rejects.toThrow();
    expect(writer.hasPending()).toBe(true);
    expect(status).toHaveBeenCalledWith('thales-1', 'conflict', 'Modification ailleurs');
    writer.change('thales-1', 'Mon texte amélioré');
    await expect(writer.flushAll()).rejects.toThrow();
    expect(save).toHaveBeenCalledTimes(1);
    await writer.keepDraft('thales-1', recorded('Autre appareil', 3));
    expect(save.mock.calls[1][1]).toEqual({ text: 'Mon texte amélioré', expectedVersion: 3 });
    writer.dispose();
  });
  it('permet de charger la version enregistrée sans la réécrire', async () => {
    const save = vi.fn<NotePort['save']>().mockRejectedValue(new Error('Hors ligne'));
    const { writer } = setup(save);
    writer.change('thales-1', 'Brouillon');
    await expect(writer.flush('thales-1')).rejects.toThrow();
    writer.replace('thales-1', recorded('Version enregistrée', 2));
    expect(writer.hasPending()).toBe(false);
    await writer.flushAll();
    expect(save).toHaveBeenCalledTimes(1);
    writer.dispose();
  });
  it('ne réécrit pas un texte inchangé et arrête les tâches après déconnexion', async () => {
    vi.useFakeTimers();
    const save = vi.fn<NotePort['save']>();
    const { writer } = setup(save);
    writer.restore('thales-1', recorded('Identique', 1));
    writer.change('thales-1', 'Identique');
    await writer.flushAll();
    expect(save).not.toHaveBeenCalled();
    writer.change('thales-1', 'Brouillon');
    writer.dispose();
    await vi.advanceTimersByTimeAsync(200);
    expect(save).not.toHaveBeenCalled();
  });
  it('garde le texte lorsqu’un service échoue avant de retourner une promesse', async () => {
    const save = vi.fn<NotePort['save']>().mockImplementation(() => {
      throw new Error('Entrée refusée');
    });
    const { writer, status } = setup(save);
    writer.change('thales-1', 'Brouillon');
    await expect(writer.flushAll()).rejects.toThrow('Entrée refusée');
    expect(writer.hasPending()).toBe(true);
    expect(status).toHaveBeenCalledWith('thales-1', 'error', 'Entrée refusée');
    writer.dispose();
  });
});
