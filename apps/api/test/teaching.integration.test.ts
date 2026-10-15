import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/adapters/http/server';
import { serverOptions } from './support';
import { Authentication } from '../src/application/authentication';
import { Exercises } from '../src/application/exercises';
import { PostgresQuizzes } from '../src/adapters/postgres/quiz-repository';
import { Teaching } from '../src/application/teaching';
import { Catalog } from '../src/application/catalog';
import { PostgresTeaching } from '../src/adapters/postgres/teaching-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { passwords, tokens } from '../src/adapters/security/credentials';
import type { TeachingContent, TeachingCourse } from '@edutube/contracts/teaching';
describe.runIf(!!process.env.DATABASE_URL)('Espace enseignant PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prefix = randomUUID();
  const emails = ['teacher', 'other', 'learner'].map((name) => `${prefix}-${name}@example.test`);
  const origin = 'http://localhost:3082';
  let server: Awaited<ReturnType<typeof createServer>>;
  let teacher: Record<string, string>;
  let other: Record<string, string>;
  let learner: Record<string, string>;
  let course: TeachingCourse;
  let content: TeachingContent;
  const call = (
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    headers: Record<string, string>,
    payload?: Record<string, unknown>,
  ) =>
    server.inject({
      method,
      url: `/api/v1${path}`,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
  beforeAll(async () => {
    const subject = await pool.query<{ id: string }>('SELECT id FROM subjects LIMIT 1');
    content = {
      title: 'Cours de test enseignant',
      shortDescription: 'Une introduction',
      description: 'Un cours construit par un enseignant.',
      subjectId: subject.rows[0].id,
      schoolLevel: 'MIDDLE',
      language: 'fr',
      palette: 'blue',
      illustration: 'geometry',
      outcomes: ['Savoir raisonner'],
      prerequisites: [],
      lessons: [
        {
          id: randomUUID(),
          title: 'Première leçon',
          kind: 'READING',
          estimatedMinutes: 15,
          previewAllowed: true,
          requiresQuiz: false,
          blocks: [{ type: 'PARAGRAPH', text: 'Voici une leçon complète.' }],
        },
      ],
      quiz: {
        title: 'Quiz final',
        passingScore: 70,
        questions: [
          {
            id: randomUUID(),
            prompt: 'Deux plus deux ?',
            options: [
              { id: 'four', text: 'Quatre' },
              { id: 'five', text: 'Cinq' },
            ],
            correctOptionId: 'four',
            explanation: 'Deux et deux font quatre.',
          },
        ],
      },
    };
    server = await createServer({
      ...serverOptions().options,
      authentication: new Authentication(new PostgresAccounts(pool), passwords, tokens),
      catalog: new Catalog(new PostgresCatalog(pool)),
      exercises: new Exercises(new PostgresQuizzes(pool)),
      teaching: new Teaching(new PostgresTeaching(pool)),
    });
    const signup = async (email: string, role: string) => {
      const response = await call(
        'POST',
        '/auth/register',
        { origin },
        { email, password: 'mot-de-passe-test-enseignant', displayName: 'Enseignant de test' },
      );
      expect(response.statusCode).toBe(201);
      expect(response.json().data.learner.role).toBe('LEARNER');
      await pool.query('UPDATE accounts SET role=$2 WHERE email=$1', [email, role]);
      return {
        origin,
        cookie: (response.headers['set-cookie'] as string).split(';')[0],
        'x-csrf-token': response.json().data.csrfToken as string,
      };
    };
    teacher = await signup(emails[0], 'TEACHER');
    other = await signup(emails[1], 'TEACHER');
    learner = await signup(emails[2], 'LEARNER');
  });
  afterAll(async () => {
    await pool.query(
      'DELETE FROM quiz_attempts WHERE account_id IN (SELECT id FROM accounts WHERE email=ANY($1::text[]))',
      [emails],
    );
    await pool.query(
      'DELETE FROM course_audit WHERE account_id IN (SELECT id FROM accounts WHERE email=ANY($1::text[]))',
      [emails],
    );
    await pool.query(
      'DELETE FROM courses WHERE owner_id IN (SELECT id FROM accounts WHERE email=ANY($1::text[]))',
      [emails],
    );
    await pool.query(
      'DELETE FROM instructors WHERE id IN (SELECT id::text FROM accounts WHERE email=ANY($1::text[]))',
      [emails],
    );
    await pool.query('DELETE FROM accounts WHERE email=ANY($1::text[])', [emails]);
    await server?.close();
    await pool.end();
  });
  it('refuse les visiteurs, les élèves, le rôle imposé et les demandes sans CSRF', async () => {
    expect((await call('GET', '/teaching/courses', {})).statusCode).toBe(401);
    expect((await call('GET', '/teaching/courses', learner)).statusCode).toBe(403);
    expect(
      (
        await call(
          'POST',
          '/auth/register',
          { origin },
          {
            email: `bad-${prefix}@example.test`,
            password: 'mot-de-passe-test-enseignant',
            displayName: 'Test',
            role: 'ADMIN',
          },
        )
      ).statusCode,
    ).toBe(400);
    const { 'x-csrf-token': _csrf, ...headers } = teacher;
    expect((await call('POST', '/teaching/courses', headers, content)).statusCode).toBe(403);
  });
  it('crée un brouillon privé et protège le contenu et les corrections entre enseignants', async () => {
    const response = await call('POST', '/teaching/courses', teacher, content);
    expect(response.statusCode).toBe(201);
    course = response.json().data;
    expect(course.status).toBe('DRAFT');
    expect(course.quiz?.questions[0].correctOptionId).toBe('four');
    expect((await call('GET', `/courses/${course.id}`, {})).statusCode).toBe(404);
    expect((await call('GET', `/teaching/courses/${course.id}`, other)).statusCode).toBe(404);
    expect((await call('GET', '/teaching/courses', other)).json().data).toEqual([]);
    expect(
      (
        await call('PUT', `/teaching/courses/${course.id}`, other, {
          ...content,
          expectedRevision: course.revision,
        })
      ).statusCode,
    ).toBe(404);
  });
  it('détecte un enregistrement concurrent sans écraser le cours', async () => {
    const responses = await Promise.all(
      ['Premier titre', 'Deuxième titre'].map((title) =>
        call('PUT', `/teaching/courses/${course.id}`, teacher, {
          ...content,
          title,
          expectedRevision: course.revision,
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    course = responses.find((response) => response.statusCode === 200)!.json().data;
  });
  it('publie, interdit les modifications publiées, retire et archive', async () => {
    const published = await call('PUT', `/teaching/courses/${course.id}/status`, teacher, {
      status: 'PUBLISHED',
      expectedRevision: course.revision,
    });
    expect(published.statusCode).toBe(200);
    course = published.json().data;
    const publicCourse = await call('GET', `/courses/${course.id}`, {});
    expect(publicCourse.statusCode).toBe(200);
    expect(publicCourse.json().data.lessons[0].id).toBe(content.lessons[0].id);
    expect(publicCourse.body).not.toContain('correctOptionId');
    const publicQuiz = await call('GET', `/courses/${course.id}/quiz`, learner);
    expect(publicQuiz.statusCode).toBe(200);
    expect(publicQuiz.body).not.toContain('correctOptionId');
    expect(publicQuiz.body).not.toContain('explanation');
    const quiz = publicQuiz.json().data;
    const attempt = await call(
      'POST',
      `/me/quizzes/${quiz.id}/attempts`,
      { ...learner, 'idempotency-key': 'teacher-published-test' },
      {
        quizRevision: quiz.revision,
        answers: [{ questionId: content.quiz!.questions[0].id, optionId: 'four' }],
      },
    );
    expect(attempt.statusCode).toBe(201);
    expect(attempt.json().data.summary.scorePercent).toBe(100);

    expect(
      (
        await call('PUT', `/teaching/courses/${course.id}`, teacher, {
          ...content,
          expectedRevision: course.revision,
        })
      ).statusCode,
    ).toBe(409);
    const archived = await call('PUT', `/teaching/courses/${course.id}/status`, teacher, {
      status: 'ARCHIVED',
      expectedRevision: course.revision,
    });
    expect(archived.statusCode).toBe(200);
    course = archived.json().data;
    expect((await call('GET', `/courses/${course.id}`, {})).statusCode).toBe(404);
    course = (
      await call('PUT', `/teaching/courses/${course.id}/status`, teacher, {
        status: 'DRAFT',
        expectedRevision: course.revision,
      })
    ).json().data;
  });
  it('réorganise les chapitres et refuse leur suppression ainsi que les identifiants étrangers', async () => {
    const second = { ...content.lessons[0], id: randomUUID(), title: 'Deuxième leçon' };
    const changed = await call('PUT', `/teaching/courses/${course.id}`, teacher, {
      ...content,
      lessons: [second, content.lessons[0]],
      expectedRevision: course.revision,
    });
    expect(changed.statusCode).toBe(200);
    course = changed.json().data;
    expect(course.lessons.map((lesson) => lesson.title)).toEqual([
      'Deuxième leçon',
      'Première leçon',
    ]);
    const previous = await pool.query(
      'SELECT result FROM quiz_attempts WHERE request_key=$1 AND quiz_id IN (SELECT id FROM quizzes WHERE course_id=$2)',
      ['teacher-published-test', course.id],
    );
    expect(previous.rows[0].result.summary.scorePercent).toBe(100);
    expect(previous.rows[0].result.summary.quizRevision).toBeLessThan(course.revision);

    expect(
      (
        await call('PUT', `/teaching/courses/${course.id}`, teacher, {
          ...content,
          expectedRevision: course.revision,
        })
      ).statusCode,
    ).toBe(409);
    const foreign = { ...content, lessons: [{ ...content.lessons[0], id: 'thales-1' }] };
    expect((await call('POST', '/teaching/courses', other, foreign)).statusCode).toBe(409);
    expect((await call('GET', '/teaching/courses', other)).json().data).toEqual([]);
  });
  it('valide les corrections et interdit la publication d’un cours vide', async () => {
    const invalid = {
      ...content,
      quiz: {
        ...content.quiz!,
        questions: [{ ...content.quiz!.questions[0], correctOptionId: 'missing' }],
      },
    };
    expect((await call('POST', '/teaching/courses', teacher, invalid)).statusCode).toBe(400);
    const response = await call('POST', '/teaching/courses', teacher, {
      ...content,
      quiz: null,
      lessons: [],
    });
    expect(response.statusCode).toBe(201);
    const empty = response.json().data;
    expect(
      (
        await call('PUT', `/teaching/courses/${empty.id}/status`, teacher, {
          status: 'PUBLISHED',
          expectedRevision: empty.revision,
        })
      ).statusCode,
    ).toBe(409);
    const audit = await pool.query('SELECT action FROM course_audit WHERE course_id=$1', [
      course.id,
    ]);
    expect(audit.rows.map((row) => row.action)).toContain('PUBLISHED');
    await pool.query("UPDATE accounts SET role='LEARNER' WHERE email=$1", [emails[0]]);
    expect((await call('GET', '/teaching/courses', teacher)).statusCode).toBe(403);
  });
});
