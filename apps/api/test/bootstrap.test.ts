import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../src/bootstrap';
import { readConfiguration } from '../src/config/environment';

const dependencies = vi.hoisted(() => ({
  query: vi.fn(),
  end: vi.fn(),
  ready: vi.fn(),
  close: vi.fn(),
  startMail: vi.fn(),
  startVideos: vi.fn(),
  stopMail: vi.fn(),
  stopVideos: vi.fn(),
}));
vi.mock('pg', () => ({
  Pool: class {
    query = dependencies.query;
    end = dependencies.end;
    ['on']() {}
  },
}));
vi.mock('../src/adapters/storage/video-storages', () => ({
  configuredVideoStorages: () => ({
    get: () => ({ ready: dependencies.ready }),
    close: dependencies.close,
  }),
}));
vi.mock('../src/adapters/mail', () => ({ mailDelivery: dependencies.startMail }));
vi.mock('../src/application/video-processing', () => ({
  startVideoProcessing: dependencies.startVideos,
}));
const directories: string[] = [];
const applications: Awaited<ReturnType<typeof createApplication>>[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  dependencies.query.mockResolvedValue({ rows: [] });
  dependencies.end.mockResolvedValue(undefined);
  dependencies.ready.mockResolvedValue(undefined);
  dependencies.startMail.mockReturnValue(dependencies.stopMail);
  dependencies.startVideos.mockReturnValue(dependencies.stopVideos);
});
afterEach(async () => {
  for (const app of applications.splice(0)) {
    await app.close();
  }
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});
async function configuration() {
  const directory = await mkdtemp(join(tmpdir(), 'edutube-bootstrap-'));
  directories.push(directory);
  return readConfiguration({
    DATABASE_URL: 'postgresql://example.test/edutube',
    STORAGE_DIR: directory,
    LOG_LEVEL: 'silent',
  });
}
it('ferme la base si elle n’est pas prête, sans lancer les traitements', async () => {
  dependencies.query.mockRejectedValue(new Error('Base indisponible.'));
  await expect(createApplication(await configuration())).rejects.toThrow(/PostgreSQL indisponible/);
  expect(dependencies.end).toHaveBeenCalledOnce();
  expect(dependencies.startMail).not.toHaveBeenCalled();
  expect(dependencies.startVideos).not.toHaveBeenCalled();
});
it('libère la base et le stockage si sa vérification échoue', async () => {
  dependencies.ready.mockRejectedValue(new Error('Stockage indisponible.'));
  await expect(createApplication(await configuration())).rejects.toThrow(
    /Stockage vidéo indisponible/,
  );
  expect(dependencies.end).toHaveBeenCalledOnce();
  expect(dependencies.close).toHaveBeenCalledOnce();
});
it('lance les traitements après l’écoute puis les ferme avec la base et le stockage', async () => {
  const app = await createApplication(await configuration());
  applications.push(app);
  await app.ready();
  expect(dependencies.startMail).not.toHaveBeenCalled();
  expect(dependencies.startVideos).not.toHaveBeenCalled();
  await app.listen({ host: '127.0.0.1', port: 0 });
  expect(dependencies.startMail).toHaveBeenCalledOnce();
  expect(dependencies.startVideos).toHaveBeenCalledOnce();
  await app.close();
  expect(dependencies.stopMail).toHaveBeenCalledOnce();
  expect(dependencies.stopVideos).toHaveBeenCalledOnce();
  expect(dependencies.end).toHaveBeenCalledOnce();
  expect(dependencies.close).toHaveBeenCalledOnce();
});
