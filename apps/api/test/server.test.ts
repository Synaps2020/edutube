import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from '../src/adapters/http/server';
import { serverOptions } from './support';
import { passwords } from '../src/adapters/security/credentials';
import { Authentication } from '../src/application/authentication';
import { tokens } from '../src/adapters/security/credentials';
import { gradeQuiz, publicQuiz } from '../src/domain/quiz';
const servers: Awaited<ReturnType<typeof createServer>>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});
async function setup() {
  const { accounts, options } = serverOptions();
  const server = await createServer(options);
  servers.push(server);
  return { server, accounts };
}
const origin = 'http://localhost:3082';
const registration = {
  email: 'eleve@example.test',
  password: 'un-mot-de-passe-long',
  displayName: 'Une élève',
};
describe('Routes et comptes', () => {
  it('sert un catalogue validé et un aperçu public', async () => {
    const { server } = await setup();
    const catalog = await server.inject('/api/v1/courses?page=1&pageSize=2&featured=true');
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().data.pagination.pageSize).toBe(2);
    expect((await server.inject('/api/v1/courses/geometry/lessons/geometry-1')).statusCode).toBe(
      200,
    );
    expect((await server.inject('/api/v1/courses/geometry/lessons/geometry-2')).statusCode).toBe(
      401,
    );
    expect((await server.inject('/api/v1/courses/geometry/lessons/autre')).statusCode).toBe(404);
  });
  it('refuse les paramètres invalides et renvoie une erreur lisible', async () => {
    const { server } = await setup();
    const response = await server.inject('/api/v1/courses?page=0');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.requestId).toBeTruthy();
    expect((await server.inject('/api/v1/courses?featured=maybe')).statusCode).toBe(400);
    expect((await server.inject('/api/v1/unknown')).statusCode).toBe(404);
  });
  it('crée une session sans envoyer de secret et la révoque', async () => {
    const { server, accounts } = await setup();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin },
      payload: registration,
    });
    expect(response.statusCode).toBe(201);
    const cookie = response.headers['set-cookie'] as string;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('tokenHash');
    expect(accounts.sessions.size).toBe(1);
    const headers = { cookie: cookie.split(';')[0], origin };
    expect((await server.inject({ url: '/api/v1/auth/session', headers })).statusCode).toBe(200);
    expect(
      (await server.inject({ url: '/api/v1/courses/geometry/lessons/geometry-2', headers }))
        .statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ method: 'POST', url: '/api/v1/auth/logout', headers })).statusCode,
    ).toBe(403);
    const logout = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { ...headers, 'x-csrf-token': response.json().data.csrfToken },
    });
    expect(logout.statusCode).toBe(204);
    expect(accounts.sessions.size).toBe(0);
    expect((await server.inject({ url: '/api/v1/auth/session', headers })).statusCode).toBe(401);
  });
  it('refuse une origine étrangère et un mot de passe trop court', async () => {
    const { server } = await setup();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: { origin: 'http://autre.test' },
          payload: registration,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: { origin },
          payload: { ...registration, password: 'court' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('normalise les adresses et refuse les doublons', async () => {
    const { server } = await setup();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: { origin },
          payload: { ...registration, email: 'ELEVE@example.test' },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: { origin },
          payload: registration,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: { origin },
          payload: { email: registration.email, password: 'incorrect' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: { origin },
          payload: registration,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: { origin },
          payload: { email: registration.email, password: registration.password },
        })
      ).statusCode,
    ).toBe(200);
  });
  it('borne les tentatives de connexion', async () => {
    const { server } = await setup();
    for (let index = 0; index < 10; index++) {
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin },
        payload: {},
      });
    }
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin },
      payload: {},
    });
    expect(response.statusCode).toBe(429);
    expect(response.json().error.code).toBe('RATE_LIMITED');
  });
});
describe('Règles de sécurité', () => {
  it('sale les mots de passe et compare leurs empreintes', async () => {
    const first = await passwords.hash(registration.password);
    const second = await passwords.hash(registration.password);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(registration.password);
    expect(await passwords.verify(registration.password, first)).toBe(true);
    expect(await passwords.verify('incorrect', first)).toBe(false);
  });
  it('refuse une session expirée', async () => {
    const { accounts } = serverOptions();
    let now = new Date('2026-10-14T10:00:00Z');
    const auth = new Authentication(accounts, passwords, tokens, () => now);
    const result = await auth.register(registration);
    expect(await auth.session(result.token)).not.toBeNull();
    now = new Date('2026-10-22T10:00:00Z');
    expect(await auth.session(result.token)).toBeNull();
  });
  it('garde les bonnes réponses privées et vérifie les réponses reçues', () => {
    const quiz = {
      id: 'quiz',
      courseId: 'geometry',
      title: 'Exercice',
      revision: 1,
      questions: [
        {
          id: 'question',
          prompt: 'Question ?',
          options: [
            { id: 'first', text: 'A' },
            { id: 'second', text: 'B' },
          ],
          correctOptionId: 'first',
          explanation: 'Voici pourquoi.',
        },
      ],
    };
    expect(JSON.stringify(publicQuiz(quiz))).not.toContain('correctOptionId');
    expect(gradeQuiz(quiz, 1, [{ questionId: 'question', optionId: 'first' }])[0].correct).toBe(
      true,
    );
    expect(() => gradeQuiz(quiz, 2, [{ questionId: 'question', optionId: 'first' }])).toThrow();
    expect(() => gradeQuiz(quiz, 1, [{ questionId: 'autre', optionId: 'first' }])).toThrow();
    expect(() => gradeQuiz(quiz, 1, [{ questionId: 'question', optionId: 'inconnu' }])).toThrow();
  });
});
