import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from '../src/adapters/http/server';
import { Catalog } from '../src/application/catalog';
import { Learning } from '../src/application/learning';
import { Authentication } from '../src/application/authentication';
import { Exercises } from '../src/application/exercises';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { PostgresLearning } from '../src/adapters/postgres/learning-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { PostgresQuizzes } from '../src/adapters/postgres/quiz-repository';
import { passwords, tokens } from '../src/adapters/security/credentials';
const enabled = !!process.env.DATABASE_URL;
describe.runIf(enabled)('Apprentissage PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const catalog = new PostgresCatalog(pool);
  const repository = new PostgresLearning(pool);
  const prefix = `learning-${randomUUID()}`;
  const emails = [`${prefix}-first@example.test`, `${prefix}-second@example.test`];
  const origin = 'http://localhost:3082';
  let server: Awaited<ReturnType<typeof createServer>>;
  let first: Record<string, string>;
  let second: Record<string, string>;
  let firstId: string;
  let secondId: string;
  const request = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    headers: Record<string, string>,
    payload?: Record<string, unknown>,
  ) => server.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });
  beforeAll(async () => {
    await pool.query(
      await readFile(new URL('../../../db/fixtures/catalogue.sql', import.meta.url), 'utf8'),
    );
    server = await createServer({
      catalog: new Catalog(catalog),
      learning: new Learning(repository, catalog),
      authentication: new Authentication(new PostgresAccounts(pool), passwords, tokens),
      exercises: new Exercises(new PostgresQuizzes(pool)),
      origin,
      secureCookie: false,
      ready: async () => {
        await pool.query('SELECT 1');
      },
    });
    const signup = async (email: string) => {
      const response = await request(
        'POST',
        '/api/v1/auth/register',
        { origin },
        { email, password: 'mot-de-passe-pour-test', displayName: 'Apprenant de test' },
      );
      expect(response.statusCode).toBe(201);
      return {
        headers: {
          origin,
          cookie: (response.headers['set-cookie'] as string).split(';')[0],
          'x-csrf-token': response.json().data.csrfToken,
        },
        id: response.json().data.learner.id as string,
      };
    };
    const primary = await signup(emails[0]);
    const other = await signup(emails[1]);
    first = primary.headers;
    second = other.headers;
    firstId = primary.id;
    secondId = other.id;
  });
  afterAll(async () => {
    await pool.query('DELETE FROM accounts WHERE email=ANY($1::text[])', [emails]);
    await server?.close();
    await pool.end();
  });
  it('répète une inscription sans doublon et refuse une clé réutilisée pour un autre cours', async () => {
    const headers = { ...first, 'idempotency-key': 'course-initial' };
    const responses = await Promise.all([
      request('POST', '/api/v1/me/enrollments', headers, { courseId: 'thales' }),
      request('POST', '/api/v1/me/enrollments', headers, { courseId: 'thales' }),
    ]);
    expect(responses.map((item) => item.statusCode)).toEqual([201, 201]);
    expect(responses[0].json().data.enrollment.id).toBe(responses[1].json().data.enrollment.id);
    expect(
      (await request('POST', '/api/v1/me/enrollments', headers, { courseId: 'lecture' }))
        .statusCode,
    ).toBe(409);
    const library = await request('GET', '/api/v1/me/enrollments?pageSize=1', first);
    expect(library.json().data.pagination.total).toBe(1);
    expect(library.json().data.items[0].course.id).toBe('thales');
    expect((await request('GET', '/api/v1/me/enrollments', second)).json().data.items).toEqual([]);
  });
  it('ajoute atomiquement les cours d’un parcours et annule une inscription impossible', async () => {
    const added = await request(
      'POST',
      '/api/v1/me/learning-path-enrollments',
      { ...first, 'idempotency-key': 'path-initial' },
      { pathId: 'brevet' },
    );
    expect(added.statusCode).toBe(201);
    expect(
      added.json().data.enrollments.map((item: { course: { id: string } }) => item.course.id),
    ).toEqual(['thales', 'expression']);
    const repeated = await request(
      'POST',
      '/api/v1/me/learning-path-enrollments',
      { ...first, 'idempotency-key': 'path-initial' },
      { pathId: 'brevet' },
    );
    expect(
      repeated
        .json()
        .data.enrollments.map((item: { enrollment: { id: string } }) => item.enrollment.id),
    ).toEqual(
      added
        .json()
        .data.enrollments.map((item: { enrollment: { id: string } }) => item.enrollment.id),
    );
    await expect(
      repository.enroll(
        secondId,
        { kind: 'PATH', id: 'invalid-path', courseIds: ['thales', 'missing-course'] },
        'invalid',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(
      (await repository.enrollmentPage(secondId, { page: 1, pageSize: 100 })).pagination.total,
    ).toBe(0);
  });
  it('cumule deux chapitres terminés en parallèle et permet d’en rouvrir un', async () => {
    const responses = await Promise.all(
      ['thales-1', 'thales-2'].map((id) =>
        request('PUT', `/api/v1/me/courses/thales/lessons/${id}/progress`, first, {
          completed: true,
        }),
      ),
    );
    expect(responses.map((item) => item.statusCode)).toEqual([200, 200]);
    const progress = (await request('GET', '/api/v1/me/courses/thales/progress', first)).json()
      .data;
    expect(progress.completedLessonIds).toEqual(['thales-1', 'thales-2']);
    expect(progress.percent).toBe(50);
    expect(progress.nextLessonId).toBe('thales-3');
    expect(
      (
        await request('PUT', '/api/v1/me/courses/thales/lessons/lecture-1/progress', first, {
          completed: true,
        })
      ).statusCode,
    ).toBe(404);
    const reopened = await request(
      'PUT',
      '/api/v1/me/courses/thales/lessons/thales-1/progress',
      first,
      { completed: false },
    );
    expect(reopened.json().data.percent).toBe(25);
    for (const lessonId of ['thales-1', 'thales-3', 'thales-4']) {
      await request('PUT', `/api/v1/me/courses/thales/lessons/${lessonId}/progress`, first, {
        completed: true,
      });
    }
    const library = (await request('GET', '/api/v1/me/enrollments', first)).json().data.items;
    expect(
      library.find((item: { course: { id: string } }) => item.course.id === 'thales').enrollment
        .completedAt,
    ).toBeTruthy();
    expect(
      (await request('GET', '/api/v1/me/learning-paths/brevet/progress', first)).json().data
        .percent,
    ).toBe(50);
    expect(
      (await request('GET', '/api/v1/me/courses/thales/progress', second)).json().data.percent,
    ).toBe(0);
  });
  it('enregistre les favoris avec une date stable et les isole par compte', async () => {
    const firstSave = await request('PUT', '/api/v1/me/favorites/thales', first);
    const repeated = await request('PUT', '/api/v1/me/favorites/thales', first);
    expect(firstSave.statusCode).toBe(200);
    expect(repeated.json()).toEqual(firstSave.json());
    await request('PUT', '/api/v1/me/favorites/lecture', first);
    const filtered = await request('GET', '/api/v1/me/favorites?subjectId=maths&pageSize=1', first);
    expect(filtered.statusCode).toBe(200);
    expect(
      (await request('GET', '/api/v1/me/favorites?q=%25', first)).json().data.pagination.total,
    ).toBe(0);
    expect(filtered.json().data.pagination.total).toBe(1);
    expect((await request('GET', '/api/v1/me/favorites', second)).json().data.items).toEqual([]);
    expect((await request('DELETE', '/api/v1/me/favorites/lecture', first)).statusCode).toBe(204);
    expect((await request('DELETE', '/api/v1/me/favorites/lecture', first)).statusCode).toBe(204);
  });
  it('protège les notes contre les écritures concurrentes et accepte un envoi rejoué', async () => {
    const created = await request('PUT', '/api/v1/me/lessons/thales-2/note', first, {
      text: 'Première note',
      expectedVersion: null,
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().data.version).toBe(1);
    expect(
      (await request('GET', '/api/v1/me/lessons/thales-2/note', second)).json().data,
    ).toBeNull();
    const responses = await Promise.all(
      ['Version appareil A', 'Version appareil B'].map((text) =>
        request('PUT', '/api/v1/me/lessons/thales-2/note', first, { text, expectedVersion: 1 }),
      ),
    );
    expect(responses.map((item) => item.statusCode).sort()).toEqual([200, 409]);
    const conflict = responses.find((item) => item.statusCode === 409)!;
    expect(conflict.json().error.code).toBe('REVISION_CONFLICT');
    const current = (await request('GET', '/api/v1/me/lessons/thales-2/note', first)).json().data;
    expect(current.version).toBe(2);
    const replay = await request('PUT', '/api/v1/me/lessons/thales-2/note', first, {
      text: current.text,
      expectedVersion: 1,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.version).toBe(2);
    expect(
      (
        await request('PUT', '/api/v1/me/lessons/thales-2/note', first, {
          text: 't'.repeat(20001),
          expectedVersion: 2,
        })
      ).statusCode,
    ).toBe(400);
    const notebook = (await request('GET', '/api/v1/me/notes?pageSize=1', first)).json().data;
    expect(notebook.items[0].lessonTitle).toContain('Thalès');
    expect(notebook.pagination.total).toBe(1);
    await request('PUT', '/api/v1/me/lessons/thales-2/note', first, {
      text: '',
      expectedVersion: 2,
    });
    expect((await request('GET', '/api/v1/me/notes', first)).json().data.pagination.total).toBe(0);
  });
  it('retrouve la dernière étape et le bilan après une nouvelle connexion', async () => {
    expect(
      (
        await request('PUT', '/api/v1/me/resume', first, {
          courseId: 'thales',
          lessonId: 'lecture-1',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request('PUT', '/api/v1/me/resume', first, {
          courseId: 'thales',
          lessonId: 'thales-3',
        })
      ).statusCode,
    ).toBe(200);
    const login = await request(
      'POST',
      '/api/v1/auth/login',
      { origin },
      { email: emails[0], password: 'mot-de-passe-pour-test' },
    );
    const otherDevice = {
      origin,
      cookie: (login.headers['set-cookie'] as string).split(';')[0],
      'x-csrf-token': login.json().data.csrfToken,
    };
    expect((await request('GET', '/api/v1/me/resume', otherDevice)).json().data.lessonId).toBe(
      'thales-3',
    );
    const dashboard = await request('GET', '/api/v1/me/dashboard', otherDevice);
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().data.counts).toMatchObject({
      enrolledCourses: 2,
      completedCourses: 1,
      completedLessons: 4,
      favorites: 1,
      notes: 0,
    });
    expect((await request('GET', '/api/v1/me/resume', second)).json().data).toBeNull();
    expect(
      (await request('GET', '/api/v1/me/quiz-attempts', second)).json().data.pagination.total,
    ).toBe(0);
    expect(
      (await request('GET', '/api/v1/me/enrollments?page=99', otherDevice)).json().data.pagination
        .total,
    ).toBe(2);
  });
  it('refuse les accès anonymes, les modifications sans jeton et les identifiants de compte imposés', async () => {
    expect((await server.inject('/api/v1/me/notes')).statusCode).toBe(401);
    expect(
      (await request('PUT', '/api/v1/me/favorites/thales', { origin, cookie: first.cookie }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          'POST',
          '/api/v1/me/enrollments',
          { ...first, 'idempotency-key': 'injected' },
          { courseId: 'lecture', accountId: secondId },
        )
      ).statusCode,
    ).toBe(400);
    expect((await request('GET', '/api/v1/me/notes?accountId=' + secondId, first)).statusCode).toBe(
      400,
    );
    expect((await repository.enrollment(firstId, 'thales'))?.completedLessonIds).toHaveLength(4);
  });
});
