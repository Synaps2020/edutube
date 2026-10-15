import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createServer } from '../src/adapters/http/server';
import { serverOptions } from './support';
import { Authentication } from '../src/application/authentication';
import { Administration } from '../src/application/administration';
import { Teaching } from '../src/application/teaching';
import { Catalog } from '../src/application/catalog';
import { ChapterAccess } from '../src/application/chapter-access';
import { PostgresAdministration } from '../src/adapters/postgres/administration-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { PostgresTeaching } from '../src/adapters/postgres/teaching-repository';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { PostgresChapterAccess } from '../src/adapters/postgres/chapter-access';
import { passwords, tokens } from '../src/adapters/security/credentials';
import type { Account } from '../src/domain/account';
import type { TeachingCourse } from '@edutube/contracts/teaching';
describe.runIf(!!process.env.DATABASE_URL)('Administration PostgreSQL', () => {
  const schema = `admin_${randomUUID().replaceAll('-', '')}`;
  const rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema},public`,
  });
  const origin = 'http://localhost:3082';
  const reason = 'Vérification des droits pendant les tests.';
  const password = 'Mot-de-passe-test-2026!';
  const records = new Map<Account['role'], { account: Account; headers: Record<string, string> }>();
  const authentication = new Authentication(new PostgresAccounts(pool), passwords, tokens);
  const repository = new PostgresAdministration(pool);
  let invitationCount = 0;
  let server: Awaited<ReturnType<typeof createServer>>;
  let course: TeachingCourse;
  const call = (
    role: Account['role'],
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    payload?: Record<string, unknown>,
  ) =>
    server.inject({
      method,
      url: `/api/v1/administration${path}`,
      headers: records.get(role)!.headers,
      ...(payload ? { payload } : {}),
    });
  beforeAll(async () => {
    await rootPool.query(`CREATE SCHEMA ${schema}`);
    const directory = new URL('../../../db/migrations/', import.meta.url);
    const files = (await readdir(directory))
      .filter((name) => /^V\d+__.*\.sql$/.test(name))
      .sort(
        (left, right) => Number(left.match(/^V(\d+)/)![1]) - Number(right.match(/^V(\d+)/)![1]),
      );
    for (const file of files) {
      await pool.query(await readFile(new URL(file, directory), 'utf8'));
    }
    await pool.query(
      await readFile(new URL('../../../db/fixtures/catalogue.sql', import.meta.url), 'utf8'),
    );
    for (const role of ['LEARNER', 'TEACHER', 'ADMIN', 'REGULATOR', 'SUPER_ADMIN'] as const) {
      const email = `${role.toLowerCase()}@administration.test`;
      const registered = await authentication.register({
        email,
        password,
        displayName: `Compte ${role}`,
      });
      await pool.query('UPDATE accounts SET role=$2 WHERE id=$1', [
        registered.session.account.id,
        role,
      ]);
      const login = await authentication.login(email, password);
      records.set(role, {
        account: login.session.account,
        headers: {
          origin,
          cookie: `edutube_session=${login.token}`,
          'x-csrf-token': login.session.csrfToken,
        },
      });
    }
    const catalog = new PostgresCatalog(pool);
    server = await createServer({
      ...serverOptions().options,
      authentication,
      catalog: new Catalog(catalog),
      chapterAccess: new ChapterAccess(new PostgresChapterAccess(pool)),
      teaching: new Teaching(new PostgresTeaching(pool)),
      administration: new Administration(repository, async () => {
        invitationCount += 1;
        const token = invitationCount === 1 ? 'invitation-test' : tokens.create();
        return {
          passwordHash: await passwords.hash(tokens.create()),
          tokenHash: tokens.digest(token),
          link: `${origin}/nouveau-mot-de-passe#token=${token}`,
        };
      }),
    });
    course = await new Teaching(new PostgresTeaching(pool)).create(
      records.get('TEACHER')!.account,
      {
        title: 'Cours à contrôler',
        shortDescription: 'Un cours de vérification',
        description: 'Le contenu complet du cours à examiner.',
        subjectId: 'maths',
        schoolLevel: 'MIDDLE',
        language: 'fr',
        palette: 'blue',
        illustration: 'geometry',
        outcomes: ['Savoir vérifier'],
        prerequisites: [],
        lessons: [
          {
            id: randomUUID(),
            title: 'Chapitre de vérification',
            kind: 'READING',
            estimatedMinutes: 10,
            previewAllowed: true,
            requiresQuiz: false,
            blocks: [{ type: 'PARAGRAPH', text: 'Une explication vérifiable.' }],
          },
        ],
        quiz: null,
      },
    );
  });
  afterAll(async () => {
    await server?.close();
    await pool.end();
    await rootPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await rootPool.end();
  });
  it('refuse les accès publics et les rôles non autorisés', async () => {
    expect((await server.inject('/api/v1/administration/accounts')).statusCode).toBe(401);
    for (const role of ['LEARNER', 'TEACHER', 'ADMIN'] as const) {
      expect((await call(role, 'GET', '/courses')).statusCode).toBe(403);
      expect((await call(role, 'GET', '/journal')).statusCode).toBe(403);
    }
    expect((await call('REGULATOR', 'GET', '/accounts')).statusCode).toBe(403);
    expect(
      (
        await call('REGULATOR', 'POST', '/accounts', {
          email: 'forbidden@administration.test',
          displayName: 'Sans droit',
          role: 'SUPER_ADMIN',
          reason,
        })
      ).statusCode,
    ).toBe(403);
  });
  it('liste les comptes sans secrets et journalise les consultations', async () => {
    const response = await call('SUPER_ADMIN', 'GET', '/accounts?query=teacher');
    expect(response.statusCode).toBe(200);
    expect(response.json().data.total).toBe(1);
    expect(response.json().data.items[0].passwordHash).toBeUndefined();
    expect(response.body).not.toContain('password_hash');
    expect(
      (await pool.query("SELECT 1 FROM administration_audit WHERE action='ACCOUNTS_READ'"))
        .rowCount,
    ).toBe(1);
  });
  it('calcule les indicateurs en base et protège les statistiques de comptes', async () => {
    expect((await server.inject('/api/v1/administration/overview')).statusCode).toBe(401);
    expect((await call('LEARNER', 'GET', '/overview')).statusCode).toBe(403);
    const overview = await call('SUPER_ADMIN', 'GET', '/overview');
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data.accounts).toMatchObject({
      total: 5,
      active: 5,
      suspended: 0,
      teachers: 2,
      regulators: 1,
    });
    expect(overview.json().data.courses).toMatchObject({ total: 7, published: 6, draft: 1 });
    expect(overview.json().data.videos).toEqual({ ready: 0, processing: 0, failed: 0 });
    expect(overview.json().data.activity).toHaveLength(7);
    const regulator = await call('REGULATOR', 'GET', '/overview');
    expect(regulator.statusCode).toBe(200);
    expect(regulator.json().data.accounts).toBeNull();
    expect(
      (await pool.query("SELECT 1 FROM administration_audit WHERE action='OVERVIEW_READ'"))
        .rowCount,
    ).toBe(2);
  });
  it('applique les filtres de gestion côté serveur et dans le total des résultats', async () => {
    const teachers = await call('SUPER_ADMIN', 'GET', '/accounts?filter=TEACHER');
    expect(teachers.statusCode).toBe(200);
    expect(teachers.json().data.total).toBe(2);
    expect(
      teachers
        .json()
        .data.items.every((account: { role: string }) =>
          ['TEACHER', 'ADMIN'].includes(account.role),
        ),
    ).toBe(true);
    const drafts = await call('REGULATOR', 'GET', '/courses?filter=DRAFT');
    expect(drafts.statusCode).toBe(200);
    expect(drafts.json().data.total).toBe(1);
    expect(drafts.json().data.items[0].id).toBe(course.id);
    const videos = await call('REGULATOR', 'GET', '/courses?filter=video_failed');
    expect(videos.statusCode).toBe(200);
    expect(videos.json().data.total).toBe(0);
    expect((await call('SUPER_ADMIN', 'GET', '/accounts?filter=inconnu')).statusCode).toBe(400);
  });
  it('examine aussi les cours non publiés', async () => {
    const response = await call('REGULATOR', 'GET', `/courses/${course.id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json().data.lessons[0].blocks[0].text).toBe('Une explication vérifiable.');
    expect(
      (
        await pool.query(
          "SELECT 1 FROM administration_audit WHERE action='COURSE_REVIEWED' AND target=$1",
          [course.id],
        )
      ).rowCount,
    ).toBe(1);
  });
  it('invite un régulateur avec un lien privé à usage unique, sans mot de passe partagé', async () => {
    const response = await call('SUPER_ADMIN', 'POST', '/accounts', {
      email: 'invite@administration.test',
      displayName: 'Régulatrice invitée',
      role: 'REGULATOR',
      reason,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.role).toBe('REGULATOR');
    const id = response.json().data.id;
    expect(response.body).not.toContain('invitation-test');
    expect(
      (await pool.query('SELECT content FROM mail_outbox WHERE account_id=$1', [id])).rows[0]
        .content,
    ).toContain('#token=invitation-test');
    expect(
      (await pool.query('SELECT token_hash FROM account_tokens WHERE account_id=$1', [id])).rows[0]
        .token_hash,
    ).toBe(tokens.digest('invitation-test'));
    const audit = (
      await pool.query(
        "SELECT after_state FROM administration_audit WHERE action='ACCOUNT_CREATED' AND target=$1",
        [id],
      )
    ).rows[0];
    expect(audit.after_state.email).toBe('invite@administration.test');
    expect(JSON.stringify(audit)).not.toContain('password');
    expect(
      (
        await call('SUPER_ADMIN', 'POST', '/accounts', {
          email: 'invite@administration.test',
          displayName: 'Doublon',
          role: 'REGULATOR',
          reason,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('impose un motif, la protection de session et une version à jour', async () => {
    const target = records.get('LEARNER')!.account.id;
    expect(
      (
        await call('SUPER_ADMIN', 'PUT', `/accounts/${target}`, {
          role: 'TEACHER',
          suspended: false,
          expectedRevision: 1,
          reason: 'court',
        })
      ).statusCode,
    ).toBe(400);
    const denied = await server.inject({
      method: 'PUT',
      url: `/api/v1/administration/accounts/${target}`,
      headers: { origin, cookie: records.get('SUPER_ADMIN')!.headers.cookie },
      payload: { role: 'TEACHER', suspended: false, expectedRevision: 1, reason },
    });
    expect(denied.statusCode).toBe(403);
    expect(
      (
        await call('SUPER_ADMIN', 'PUT', `/accounts/${target}`, {
          role: 'TEACHER',
          suspended: false,
          expectedRevision: 10,
          reason,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('suspend un compte et invalide immédiatement ses sessions', async () => {
    const target = records.get('LEARNER')!.account.id;
    const response = await call('SUPER_ADMIN', 'PUT', `/accounts/${target}`, {
      role: 'LEARNER',
      suspended: true,
      expectedRevision: 1,
      reason,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.suspended).toBe(true);
    expect(
      await authentication.session(records.get('LEARNER')!.headers.cookie.split('=')[1]),
    ).toBeNull();
    await expect(
      authentication.login('learner@administration.test', password),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(
      (
        await call('SUPER_ADMIN', 'PUT', `/accounts/${target}`, {
          role: 'LEARNER',
          suspended: false,
          expectedRevision: 2,
          reason,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await authentication.login('learner@administration.test', password)).session.account.id,
    ).toBe(target);
  });
  it('empêche le super-admin de retirer ses propres droits', async () => {
    const target = records.get('SUPER_ADMIN')!.account.id;
    expect(
      (
        await call('SUPER_ADMIN', 'PUT', `/accounts/${target}`, {
          role: 'REGULATOR',
          suspended: false,
          expectedRevision: 1,
          reason,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await call('SUPER_ADMIN', 'PUT', `/accounts/${target}`, {
          role: 'SUPER_ADMIN',
          suspended: true,
          expectedRevision: 1,
          reason,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('retire, supprime et restaure un cours sans détruire les données, sans contournement enseignant', async () => {
    const teaching = new Teaching(new PostgresTeaching(pool));
    course = await teaching.status(
      records.get('TEACHER')!.account,
      course.id,
      'PUBLISHED',
      course.revision,
    );
    expect((await server.inject(`/api/v1/courses/${course.id}`)).statusCode).toBe(200);
    let response = await call('REGULATOR', 'PUT', `/courses/${course.id}`, {
      action: 'WITHDRAW',
      expectedRevision: course.revision,
      reason,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.moderation).toBe('WITHDRAWN');
    expect((await server.inject(`/api/v1/courses/${course.id}`)).statusCode).toBe(404);
    expect(
      (await server.inject(`/api/v1/courses/${course.id}/lessons/${course.lessons[0].id}`))
        .statusCode,
    ).toBe(404);
    await expect(
      teaching.status(
        records.get('TEACHER')!.account,
        course.id,
        'DRAFT',
        response.json().data.revision,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      pool.query("UPDATE courses SET status='PUBLISHED' WHERE id=$1", [course.id]),
    ).rejects.toThrow('modéré');
    response = await call('REGULATOR', 'PUT', `/courses/${course.id}`, {
      action: 'DELETE',
      expectedRevision: response.json().data.revision,
      reason,
    });
    expect(response.statusCode).toBe(200);
    expect(
      (await pool.query('SELECT 1 FROM lessons WHERE course_id=$1', [course.id])).rowCount,
    ).toBe(1);
    response = await call('REGULATOR', 'PUT', `/courses/${course.id}`, {
      action: 'RESTORE',
      expectedRevision: response.json().data.revision,
      reason,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('DRAFT');
    expect((await server.inject(`/api/v1/courses/${course.id}`)).statusCode).toBe(404);
    const audit = await pool.query(
      "SELECT before_state,after_state FROM administration_audit WHERE action='COURSE_WITHDRAW' AND target=$1",
      [course.id],
    );
    expect(audit.rows[0].before_state.status).toBe('PUBLISHED');
    expect(audit.rows[0].after_state.moderation).toBe('WITHDRAWN');
  });
  it('classe le journal par date puis identifiant numérique, au-delà de neuf événements', async () => {
    const response = await call('SUPER_ADMIN', 'GET', '/journal');
    const items = response.json().data.items as { id: string; createdAt: string }[];
    expect(items.length).toBeGreaterThan(9);
    for (let position = 1; position < items.length; position += 1) {
      const before = items[position - 1];
      const after = items[position];
      expect(new Date(before.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(after.createdAt).getTime(),
      );
      if (before.createdAt === after.createdAt) {
        expect(BigInt(before.id)).toBeGreaterThan(BigInt(after.id));
      }
    }
  });
  it('isole le journal du régulateur et protège les lignes contre les modifications', async () => {
    const response = await call('REGULATOR', 'GET', '/journal');
    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .data.items.every((entry: { actor: string }) => entry.actor.includes('REGULATOR')),
    ).toBe(true);
    expect((await call('SUPER_ADMIN', 'GET', '/journal')).json().data.total).toBeGreaterThan(
      response.json().data.total,
    );
    await expect(
      pool.query("UPDATE administration_audit SET reason='modification'"),
    ).rejects.toThrow('ne peut pas être modifié');
    await expect(pool.query('DELETE FROM administration_audit')).rejects.toThrow(
      'ne peut pas être modifié',
    );
    await expect(pool.query('TRUNCATE administration_audit')).rejects.toThrow(
      'ne peut pas être modifié',
    );
  });
  it('arbitre deux changements concurrents avec la même révision', async () => {
    const target = (
      await pool.query<{ id: string; admin_revision: number }>(
        "SELECT id,admin_revision FROM accounts WHERE email='invite@administration.test'",
      )
    ).rows[0];
    const responses = await Promise.all([
      call('SUPER_ADMIN', 'PUT', `/accounts/${target.id}`, {
        role: 'TEACHER',
        suspended: false,
        expectedRevision: target.admin_revision,
        reason,
      }),
      call('SUPER_ADMIN', 'PUT', `/accounts/${target.id}`, {
        role: 'LEARNER',
        suspended: false,
        expectedRevision: target.admin_revision,
        reason,
      }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM administration_audit WHERE action='ACCOUNT_CHANGED' AND target=$1",
          [target.id],
        )
      ).rowCount,
    ).toBe(1);
  });
  it('conserve un super-admin actif lorsque deux responsables tentent de se retirer leurs droits', async () => {
    const created = await call('SUPER_ADMIN', 'POST', '/accounts', {
      email: 'second-super@administration.test',
      displayName: 'Second responsable',
      role: 'SUPER_ADMIN',
      reason,
    });
    expect(created.statusCode).toBe(201);
    const accounts = new PostgresAccounts(pool);
    const first = records.get('SUPER_ADMIN')!.account;
    const second = (await accounts.findByEmail('second-super@administration.test'))!;
    const results = await Promise.allSettled([
      repository.changeAccount({ actor: first, requestId: 'concurrence-premier' }, second.id, {
        role: 'REGULATOR',
        suspended: false,
        expectedRevision: 1,
        reason,
      }),
      repository.changeAccount({ actor: second, requestId: 'concurrence-second' }, first.id, {
        role: 'REGULATOR',
        suspended: false,
        expectedRevision: 1,
        reason,
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM accounts WHERE role='SUPER_ADMIN' AND suspended_at IS NULL",
        )
      ).rows[0].total,
    ).toBe(1);
    const currentFirst = (await accounts.findByEmail(first.email))!;
    if (currentFirst.role !== 'SUPER_ADMIN') {
      await repository.changeAccount(
        { actor: second, requestId: 'restauration-responsable' },
        first.id,
        { role: 'SUPER_ADMIN', suspended: false, expectedRevision: 2, reason },
      );
    }
    const login = await authentication.login(first.email, password);
    records.set('SUPER_ADMIN', {
      account: login.session.account,
      headers: {
        origin,
        cookie: `edutube_session=${login.token}`,
        'x-csrf-token': login.session.csrfToken,
      },
    });
  });
  it('annule aussi la création du compte si son écriture au journal échoue', async () => {
    await pool.query(
      `CREATE FUNCTION refuse_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='Rejet volontaire du journal de test' THEN RAISE EXCEPTION 'Journal indisponible'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test_audit BEFORE INSERT ON administration_audit FOR EACH ROW EXECUTE FUNCTION refuse_test_audit()`,
    );
    try {
      const response = await call('SUPER_ADMIN', 'POST', '/accounts', {
        email: 'rollback@administration.test',
        displayName: 'Création annulée',
        role: 'REGULATOR',
        reason: 'Rejet volontaire du journal de test',
      });
      expect(response.statusCode).toBe(500);
      expect(
        (await pool.query("SELECT 1 FROM accounts WHERE email='rollback@administration.test'"))
          .rowCount,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT 1 FROM mail_outbox WHERE recipient='rollback@administration.test'",
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await pool.query(
        'DROP TRIGGER reject_test_audit ON administration_audit; DROP FUNCTION refuse_test_audit()',
      );
    }
  });
  it('enregistre aussi les interventions refusées, sans conserver le formulaire', async () => {
    const response = await call('REGULATOR', 'POST', '/accounts', {
      email: 'rejected@administration.test',
      displayName: 'Tentative interdite',
      role: 'SUPER_ADMIN',
      reason,
    });
    expect(response.statusCode).toBe(403);
    const audit = await pool.query(
      "SELECT after_state FROM administration_audit WHERE action='ACTION_REJECTED' AND request_id=$1",
      [response.headers['x-request-id']],
    );
    expect(audit.rows[0].after_state).toEqual({ code: 'FORBIDDEN' });
  });
  it('relit les droits en base même si le contexte reçu est devenu ancien', async () => {
    const actor = records.get('REGULATOR')!.account;
    await pool.query("UPDATE accounts SET role='LEARNER' WHERE id=$1", [actor.id]);
    await expect(
      repository.courses({ actor, requestId: 'droits-anciens' }, { query: '', page: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await call('REGULATOR', 'GET', '/courses')).statusCode).toBe(403);
  });
});
