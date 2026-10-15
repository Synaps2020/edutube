import { createServer } from '../src/adapters/http/server';
import { Catalog } from '../src/application/catalog';
import { Learning } from '../src/application/learning';
import { Exercises } from '../src/application/exercises';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { PostgresLearning } from '../src/adapters/postgres/learning-repository';
import { PostgresQuizzes } from '../src/adapters/postgres/quiz-repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Identity } from '../src/application/identity';
import { PostgresIdentity } from '../src/adapters/postgres/identity-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { passwords, tokens } from '../src/adapters/security/credentials';
import { Authentication } from '../src/application/authentication';
describe.runIf(!!process.env.DATABASE_URL)('Finition des comptes PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const repository = new PostgresIdentity(pool);
  const issuedTokens: string[] = [];
  const testTokens = {
    create: () => {
      const token = tokens.create();
      issuedTokens.push(token);
      return token;
    },
    digest: tokens.digest,
  };
  const identity = new Identity(repository, passwords, testTokens, 'http://localhost:3082');
  const authentication = new Authentication(
    new PostgresAccounts(pool),
    passwords,
    tokens,
    undefined,
    undefined,
    () => identity.welcome(),
  );
  const email = `identity-${randomUUID()}@example.test`;
  let accountId: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  const queuedToken = async (purpose: 'VERIFY' | 'RESET') => {
    const result = await pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM account_tokens WHERE account_id=$1 AND purpose=$2',
      [accountId, purpose],
    );
    const token = issuedTokens.find((value) => tokens.digest(value) === result.rows[0]?.token_hash);
    expect(token).toBeTruthy();
    return token!;
  };
  beforeAll(async () => {
    const catalog = new PostgresCatalog(pool);
    server = await createServer({
      identity,
      authentication,
      catalog: new Catalog(catalog),
      learning: new Learning(new PostgresLearning(pool), catalog),
      exercises: new Exercises(new PostgresQuizzes(pool)),
      origin: 'http://localhost:3082',
      secureCookie: false,
      ready: async () => {
        await pool.query('SELECT 1');
      },
    });
    accountId = (
      await authentication.register({
        email,
        displayName: 'Compte de test',
        password: 'Mot-de-passe-initial!',
      })
    ).session.account.id;
  });
  afterAll(async () => {
    await server.close();
    await pool.query('DELETE FROM accounts WHERE id=$1', [accountId]);
    await pool.end();
  });
  it('protège les routes du profil et valide les formulaires HTTP', async () => {
    expect((await server.inject({ method: 'GET', url: '/api/v1/me/profile' })).statusCode).toBe(
      401,
    );
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://localhost:3082' },
      payload: { email, password: 'Mot-de-passe-initial!' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const profile = await server.inject({
      method: 'GET',
      url: '/api/v1/me/profile',
      headers: { cookie },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().data.email).toBe(email);
    expect(profile.json().data.passwordHash).toBeUndefined();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/verification/request',
          headers: { cookie, origin: 'http://localhost:3082' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/password/reset',
          headers: { origin: 'http://localhost:3082' },
          payload: { token: 'invalide', password: 'court' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/password/forgot',
          headers: { origin: 'http://autre-site.test' },
          payload: { email },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('enregistre le profil et refuse une ancienne version', async () => {
    const initial = await identity.profile(accountId);
    expect(initial.emailVerified).toBe(false);
    const input = {
      displayName: 'Aminata Test',
      schoolLevel: 'MIDDLE' as const,
      biography: 'J’apprends les sciences.',
      expectedVersion: initial.version,
    };
    expect((await identity.saveProfile(accountId, input)).displayName).toBe(input.displayName);
    await expect(identity.saveProfile(accountId, input)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
  });
  it('produit un lien privé, limité et utilisable une seule fois', async () => {
    await identity.request({ accountId }, 'VERIFY');
    await identity.request({ accountId }, 'VERIFY');
    const count = await pool.query(
      'SELECT count(*)::int AS count FROM account_tokens WHERE account_id=$1',
      [accountId],
    );
    expect(count.rows[0].count).toBe(1);
    const token = await queuedToken('VERIFY');
    const stored = await pool.query('SELECT token_hash FROM account_tokens WHERE account_id=$1', [
      accountId,
    ]);
    expect(stored.rows[0].token_hash).not.toBe(token);
    await identity.verify(token);
    expect((await identity.profile(accountId)).emailVerified).toBe(true);
    await expect(identity.verify(token)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('donne la même réponse pour une adresse absente', async () => {
    const absent = await identity.request({ email: 'absent@example.test' }, 'RESET');
    const existing = await identity.request({ email }, 'RESET');
    expect(absent).toEqual(existing);
  });
  it('refuse un lien expiré sans changer le mot de passe', async () => {
    const token = await queuedToken('RESET');
    await pool.query(
      "UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE account_id=$1",
      [accountId],
    );
    await expect(identity.reset(token, 'Nouveau-mot-de-passe!')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(authentication.login(email, 'Mot-de-passe-initial!')).resolves.toBeTruthy();
    await pool.query('DELETE FROM account_tokens WHERE account_id=$1', [accountId]);
  });
  it('réinitialise une seule fois et ferme les anciennes sessions', async () => {
    const previous = await authentication.login(email, 'Mot-de-passe-initial!');
    await identity.request({ email }, 'RESET');
    const token = await queuedToken('RESET');
    const outcomes = await Promise.allSettled([
      identity.reset(token, 'Nouveau-mot-de-passe!'),
      identity.reset(token, 'Nouveau-mot-de-passe!'),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await authentication.session(previous.token)).toBeNull();
    await expect(authentication.login(email, 'Mot-de-passe-initial!')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(authentication.login(email, 'Nouveau-mot-de-passe!')).resolves.toBeTruthy();
  });
});
