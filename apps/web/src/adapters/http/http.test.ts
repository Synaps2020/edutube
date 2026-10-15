import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  apiErrorSchema,
  courseProgressSchema,
  quizSchema,
  attemptInputSchema,
  noteInputSchema,
} from '@edutube/contracts';
import { HttpClient } from './client';
import { createApiServices, queryString } from './services';
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
afterEach(() => vi.useRealTimers());
describe('transport HTTP préparé', () => {
  it('transmet le fichier multipart avec la session et le jeton CSRF sans imposer un en-tête JSON', async () => {
    const formData = new FormData();
    formData.append('title', 'Fiche');
    formData.append('file', new Blob(['Une leçon']), 'fiche.txt');
    const transport = vi.fn(async (_input: RequestInfo | URL, input?: RequestInit) => {
      expect(input?.body).toBe(formData);
      expect(input?.credentials).toBe('include');
      const headers = new Headers(input?.headers);
      expect(headers.get('Content-Type')).toBeNull();
      expect(headers.get('X-CSRF-Token')).toBe('session-token');
      expect(headers.get('Idempotency-Key')).toBe('document-key');
      return response(true);
    });
    const client = new HttpClient(
      '/api/v1',
      transport as typeof fetch,
      10000,
      () => 'session-token',
    );
    expect(
      await client.request('/documents', z.boolean(), {
        method: 'POST',
        formData,
        idempotencyKey: 'document-key',
        timeoutMs: 60000,
      }),
    ).toBe(true);
  });
  it('aucun appel ne se produit à la création des services', () => {
    const transport = vi.fn();
    createApiServices({ baseUrl: '/api/v1', transport: transport as typeof fetch });
    expect(transport).not.toHaveBeenCalled();
  });
  it('valide les réponses et conserve la valeur zéro', async () => {
    const transport = vi.fn(async () => response({ value: 0 }));
    const client = new HttpClient('/api/v1', transport as typeof fetch);
    expect(await client.request('/test', z.object({ value: z.number() }).strict())).toEqual({
      value: 0,
    });
    expect(transport.mock.calls[0]).toBeDefined();
  });
  it('refuse une réponse incompatible au lieu de la caster', async () => {
    const client = new HttpClient(
      '/api/v1',
      vi.fn(async () => response({ value: 'bad' })) as typeof fetch,
    );
    await expect(client.request('/test', z.object({ value: z.number() }))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('propage les erreurs métier et leur identifiant', async () => {
    const error = apiErrorSchema.parse({
      error: { code: 'REVISION_CONFLICT', message: 'Version différente', requestId: 'req-1' },
    });
    const client = new HttpClient(
      '/api/v1',
      vi.fn(async () => new Response(JSON.stringify(error), { status: 409 })) as typeof fetch,
    );
    await expect(client.request('/test', z.string())).rejects.toMatchObject({
      status: 409,
      code: 'REVISION_CONFLICT',
      requestId: 'req-1',
    });
  });
  it('accepte une suppression 204 sans tenter de lire du JSON', async () => {
    const transport = vi.fn(async () => new Response(null, { status: 204 }));
    const services = createApiServices({
      baseUrl: '/api/v1',
      transport: transport as typeof fetch,
    });
    await expect(services.favorites.remove('thales')).resolves.toBeUndefined();
  });
  it('ne démarre pas une lecture déjà annulée', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn();
    const client = new HttpClient('/api/v1', transport as typeof fetch);
    await expect(
      client.request('/test', z.string(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('distingue une expiration du délai et une panne réseau', async () => {
    vi.useFakeTimers();
    const transport = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    );
    const client = new HttpClient('/api/v1', transport as typeof fetch, 20);
    const assertion = expect(client.request('/test', z.string())).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });
  it('conserve les booléens faux et encode la recherche', () => {
    expect(
      queryString({ q: 'géométrie & maths', featured: false, page: 1, unused: undefined }),
    ).toBe('?q=g%C3%A9om%C3%A9trie+%26+maths&featured=false&page=1');
  });
  it('valide une commande avant tout appel réseau', () => {
    const transport = vi.fn();
    const services = createApiServices({
      baseUrl: '/api/v1',
      transport: transport as typeof fetch,
    });
    expect(() => services.notes.save('thales-1', { text: 'note', expectedVersion: 0 })).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('envoie une intention de progression, un cookie et le CSRF', async () => {
    const progress = {
      courseId: 'thales',
      curriculumRevision: 1,
      completedLessonIds: [],
      totalLessons: 4,
      percent: 0,
      nextLessonId: 'thales-1',
      updatedAt: '2026-10-14T12:00:00Z',
    };
    const transport = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      response(progress),
    );
    const services = createApiServices({
      baseUrl: '/api/v1',
      transport: transport as typeof fetch,
      csrfToken: () => 'csrf-1',
    });
    await services.progress.setCompleted('thales', 'thales-1', false);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('/api/v1/me/courses/thales/lessons/thales-1/progress');
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe('{"completed":false}');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-1' });
  });
  it('sécurise le nom de fichier proposé', async () => {
    const transport = vi.fn(
      async () =>
        new Response('révision', {
          headers: { 'Content-Disposition': 'attachment; filename="../../revision.txt"' },
        }),
    );
    const services = createApiServices({
      baseUrl: '/api/v1',
      transport: transport as typeof fetch,
    });
    const file = await services.lessons.download('resource-1', 'fallback.txt');
    expect(file.fileName).toBe('revision.txt');
    expect(await file.blob.text()).toBe('révision');
  });
});
describe('invariants de contrat', () => {
  it('un score ou un apprenant ne peut pas être envoyé comme réponse de quiz', () => {
    expect(
      attemptInputSchema.safeParse({
        quizRevision: 1,
        answers: [{ questionId: 'q-1', optionId: 'o-1' }],
        scorePercent: 100,
        learnerId: 'someone',
      }).success,
    ).toBe(false);
  });
  it('une question ne peut pas recevoir deux réponses', () => {
    expect(
      attemptInputSchema.safeParse({
        quizRevision: 1,
        answers: [
          { questionId: 'q-1', optionId: 'o-1' },
          { questionId: 'q-1', optionId: 'o-2' },
        ],
      }).success,
    ).toBe(false);
  });
  it('le quiz public rejette une clé de correction divulguée', () => {
    expect(
      quizSchema.safeParse({
        id: 'quiz-1',
        courseId: 'course-1',
        revision: 1,
        title: 'Quiz',
        questions: [
          {
            id: 'q-1',
            prompt: 'Question',
            correctOptionId: 'o-1',
            options: [
              { id: 'o-1', text: 'A' },
              { id: 'o-2', text: 'B' },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('une création de note exige une version attendue explicite', () => {
    expect(noteInputSchema.safeParse({ text: 'note' }).success).toBe(false);
    expect(noteInputSchema.parse({ text: '', expectedVersion: null })).toEqual({
      text: '',
      expectedVersion: null,
    });
  });
  it('une progression incohérente ne passe pas la validation', () => {
    expect(
      courseProgressSchema.safeParse({
        courseId: 'c-1',
        curriculumRevision: 1,
        completedLessonIds: ['l-1'],
        totalLessons: 4,
        percent: 100,
        nextLessonId: null,
        updatedAt: '2026-10-14T12:00:00Z',
      }).success,
    ).toBe(false);
  });
});
