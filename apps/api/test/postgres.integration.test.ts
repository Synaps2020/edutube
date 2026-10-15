import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { PostgresQuizzes } from '../src/adapters/postgres/quiz-repository';
import { Learning } from '../src/application/learning';
import { PostgresLearning } from '../src/adapters/postgres/learning-repository';
import { Catalog } from '../src/application/catalog';
import { Authentication } from '../src/application/authentication';
import { Exercises } from '../src/application/exercises';
import { passwords, tokens } from '../src/adapters/security/credentials';
import { createServer } from '../src/adapters/http/server';
import { courseDetailSchema, pathDetailSchema } from '@edutube/contracts';
const enabled = Boolean(process.env.DATABASE_URL);
describe.runIf(enabled)('PostgreSQL réel', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const catalog = new PostgresCatalog(pool);
  const accounts = new PostgresAccounts(pool);
  const prefix = `test-${randomUUID()}`;
  const email = `${prefix}@example.test`;
  let server: Awaited<ReturnType<typeof createServer>>;
  beforeAll(async () => {
    await pool.query(
      await readFile(new URL('../../../db/fixtures/catalogue.sql', import.meta.url), 'utf8'),
    );
    server = await createServer({
      catalog: new Catalog(catalog),
      learning: new Learning(new PostgresLearning(pool), catalog),
      authentication: new Authentication(accounts, passwords, tokens),
      exercises: new Exercises(new PostgresQuizzes(pool)),
      origin: 'http://localhost:3082',
      secureCookie: false,
      ready: async () => {
        await pool.query('SELECT 1');
      },
    });
  });
  afterAll(async () => {
    await pool.query('DELETE FROM accounts WHERE email=$1', [email]);
    await pool.query('DELETE FROM learning_paths WHERE id=$1', [prefix]);
    await pool.query('DELETE FROM courses WHERE id=$1', [prefix]);
    await server?.close();
    await pool.end();
  });
  it('assemble les cours et parcours avec des durées cohérentes', async () => {
    expect((await server.inject('/api/v1/learning-paths')).statusCode).toBe(200);
    expect((await server.inject('/api/v1/courses')).statusCode).toBe(200);
    expect((await server.inject('/api/v1/learning-paths/brevet')).statusCode).toBe(200);
    const course = courseDetailSchema.parse(await catalog.getCourse('thales'));
    expect(course.durationMinutes).toBe(
      course.lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0),
    );
    const path = pathDetailSchema.parse(await catalog.getPath('brevet'));
    expect(path.steps.map((step) => step.order)).toEqual([0, 1]);
    expect(path.durationMinutes).toBe(
      path.steps.reduce((total, step) => total + step.course.durationMinutes, 0),
    );
    const page = await catalog.listCourses({ page: 1, pageSize: 2, sort: 'TITLE' });
    expect(page.items).toHaveLength(2);
    expect(page.pagination.total).toBeGreaterThanOrEqual(6);
    expect(
      (await catalog.listCourses({ page: 1, pageSize: 24, q: "' OR 1=1 --", sort: 'TITLE' })).items,
    ).toHaveLength(0);
    expect(
      (await catalog.listCourses({ page: 1, pageSize: 24, q: '%', sort: 'TITLE' })).items,
    ).toHaveLength(0);
  });
  it('masque un brouillon et impose le lien cours-chapitre', async () => {
    await pool.query(
      `INSERT INTO courses(id,slug,title,short_description,description,subject_id,instructor_id,school_level,outcomes,palette) SELECT $1,$1,'Brouillon','Exemple','Exemple',subject_id,instructor_id,school_level,outcomes,palette FROM courses WHERE id='thales'`,
      [prefix],
    );
    expect(await catalog.getCourse(prefix)).toBeNull();
    expect(await catalog.getLesson('lecture', 'thales-2')).toBeNull();
    await pool.query("UPDATE courses SET status='PUBLISHED',published_at=now() WHERE id=$1", [
      prefix,
    ]);
    await pool.query(
      "INSERT INTO learning_paths(id,slug,title,description,goal,palette,published) VALUES($1,$1,'Parcours incomplet','Exemple','DISCOVERY','blue',true)",
      [prefix],
    );
    await pool.query('INSERT INTO path_courses(path_id,course_id,position) VALUES($1,$1,0)', [
      prefix,
    ]);
    expect(await catalog.getPath(prefix)).toBeNull();
    expect(
      (await catalog.listPaths({ page: 1, pageSize: 100 })).items.some(
        (path) => path.id === prefix,
      ),
    ).toBe(false);
  });
  it('persiste le compte, protège les chapitres et corrige sans dévoiler avant', async () => {
    const origin = 'http://localhost:3082';
    const registration = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin },
      payload: { email, password: 'mot-de-passe-pour-test', displayName: 'Compte de test' },
    });
    expect(registration.statusCode).toBe(201);
    const cookie = (registration.headers['set-cookie'] as string).split(';')[0];
    const csrfToken = registration.json().data.csrfToken;
    const headers = { origin, cookie, 'x-csrf-token': csrfToken };
    expect((await accounts.findByEmail(email))?.passwordHash).not.toContain(
      'mot-de-passe-pour-test',
    );
    expect((await server.inject('/api/v1/courses/thales/lessons/thales-2')).statusCode).toBe(401);
    expect(
      (await server.inject({ url: '/api/v1/courses/thales/lessons/thales-2', headers })).statusCode,
    ).toBe(200);
    const quiz = await server.inject({ url: '/api/v1/courses/thales/quiz', headers });
    expect(quiz.statusCode).toBe(200);
    expect(quiz.body).not.toContain('correctOptionId');
    const data = quiz.json().data;
    const answers = data.questions.map((question: { id: string; options: { id: string }[] }) => ({
      questionId: question.id,
      optionId: question.options[0].id,
    }));
    const request = {
      method: 'POST' as const,
      url: `/api/v1/me/quizzes/${data.id}/attempts`,
      headers: { ...headers, 'idempotency-key': prefix },
      payload: { quizRevision: data.revision, answers },
    };
    const first = await server.inject(request);
    expect(first.statusCode).toBe(201);
    const replay = await server.inject(request);
    expect(replay.json()).toEqual(first.json());
    const altered = {
      ...request,
      payload: {
        ...request.payload,
        answers: answers.map((answer: { questionId: string; optionId: string }, index: number) => ({
          ...answer,
          optionId: data.questions[index].options[1].id,
        })),
      },
    };
    expect((await server.inject(altered)).statusCode).toBe(409);
    expect(
      (await server.inject({ method: 'POST', url: '/api/v1/auth/logout', headers })).statusCode,
    ).toBe(204);
    expect((await server.inject({ url: '/api/v1/auth/session', headers })).statusCode).toBe(401);
  });
});
