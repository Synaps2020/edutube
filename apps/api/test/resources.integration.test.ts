import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/adapters/http/server';
import { serverOptions } from './support';
import { Authentication } from '../src/application/authentication';
import { Teaching } from '../src/application/teaching';
import { Resources } from '../src/application/resources';
import { Catalog } from '../src/application/catalog';
import { PostgresTeaching } from '../src/adapters/postgres/teaching-repository';
import { PostgresResources } from '../src/adapters/postgres/resource-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { ResourceFiles } from '../src/adapters/storage/resource-files';
import { passwords, tokens } from '../src/adapters/security/credentials';
import { resourceLimit } from '@edutube/contracts/resources';
import type { TeachingCourse } from '@edutube/contracts/teaching';
import type { ResourceDto } from '@edutube/contracts';
describe.runIf(!!process.env.DATABASE_URL)('Documents PostgreSQL et stockage privé', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prefix = `resources-${randomUUID()}`;
  const emails = ['teacher', 'other', 'learner'].map((name) => `${prefix}-${name}@example.test`);
  const origin = 'http://localhost:3082';
  let directory: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let teacher: Record<string, string>;
  let other: Record<string, string>;
  let learner: Record<string, string>;
  let course: TeachingCourse;
  let publicFile: ResourceDto;
  let privateFile: ResourceDto;
  const text = 'Les fractions\nUne part sur quatre représente un quart : 1/4.\n';
  const pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';
  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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
  const address = (lessonId: string) =>
    `/teaching/courses/${course.id}/lessons/${lessonId}/resources`;
  async function upload(
    lessonId: string,
    headers: Record<string, string>,
    key: string,
    fileName: string,
    body: string | Uint8Array,
    revision = course.revision,
    title = 'Fiche de révision',
  ) {
    const form = new FormData();
    form.append('title', title);
    form.append('expectedRevision', String(revision));
    const content = typeof body === 'string' ? body : Uint8Array.from(body).buffer;
    form.append('file', new Blob([content]), fileName);
    const request = new Request('http://localhost', { method: 'POST', body: form });
    return server.inject({
      method: 'POST',
      url: `/api/v1${address(lessonId)}`,
      headers: {
        ...headers,
        'content-type': request.headers.get('content-type')!,
        'idempotency-key': key,
      },
      payload: Buffer.from(await request.arrayBuffer()),
    });
  }
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'edutube-resources-'));
    const storage = new ResourceFiles(directory);
    await storage.ready();
    server = await createServer({
      ...serverOptions().options,
      authentication: new Authentication(new PostgresAccounts(pool), passwords, tokens),
      teaching: new Teaching(new PostgresTeaching(pool)),
      catalog: new Catalog(new PostgresCatalog(pool)),
      resources: new Resources(new PostgresResources(pool), storage),
    });
    const signup = async (email: string, role: string) => {
      const response = await call(
        'POST',
        '/auth/register',
        { origin },
        { email, password: 'mot-de-passe-test-documents', displayName: 'Documents de test' },
      );
      expect(response.statusCode).toBe(201);
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
    const subject = await pool.query<{ id: string }>('SELECT id FROM subjects LIMIT 1');
    const response = await call('POST', '/teaching/courses', teacher, {
      title: 'Les documents du cours',
      shortDescription: 'Un cours de test',
      description: 'Des chapitres avec documents',
      subjectId: subject.rows[0].id,
      schoolLevel: 'MIDDLE',
      language: 'fr',
      palette: 'blue',
      illustration: 'geometry',
      outcomes: ['Comprendre les fractions'],
      prerequisites: [],
      quiz: null,
      lessons: [true, false].map((previewAllowed, index) => ({
        id: randomUUID(),
        title: `Chapitre ${index + 1}`,
        kind: 'READING',
        estimatedMinutes: 10,
        previewAllowed,
        blocks: [{ type: 'PARAGRAPH', text: 'Une leçon.' }],
      })),
    });
    expect(response.statusCode).toBe(201);
    course = response.json().data;
  });
  afterAll(async () => {
    try {
      await pool.query(
        'DELETE FROM resources WHERE uploaded_by IN (SELECT id FROM accounts WHERE email=ANY($1::text[]))',
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
    } finally {
      await server?.close();
      await pool.end();
      if (directory) {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
  it('refuse l’ajout aux visiteurs, élèves, autres enseignants et aux demandes sans CSRF', async () => {
    const lessonId = course.lessons[0].id;
    expect((await upload(lessonId, { origin }, 'guest', 'fiche.txt', text)).statusCode).toBe(401);
    expect((await upload(lessonId, learner, 'learner', 'fiche.txt', text)).statusCode).toBe(403);
    expect((await upload(lessonId, other, 'other', 'fiche.txt', text)).statusCode).toBe(404);
    const { 'x-csrf-token': _csrf, ...headers } = teacher;
    expect((await upload(lessonId, headers, 'csrf', 'fiche.txt', text)).statusCode).toBe(403);
    expect(await readdir(directory)).toEqual([]);
  });
  it('enregistre les octets et les métadonnées, puis rejoue sans doublon ni fichier abandonné', async () => {
    const lessonId = course.lessons[0].id;
    const revision = course.revision;
    const first = await upload(lessonId, teacher, 'first', 'révision.txt', text);
    expect(first.statusCode).toBe(201);
    publicFile = first.json().data.resources[0];
    expect(publicFile.sizeBytes).toBe(Buffer.byteLength(text));
    expect(publicFile.mediaType).toBe('text/plain');
    expect(first.body).not.toContain('storageKey');
    course.revision = first.json().data.courseRevision;
    const replay = await upload(lessonId, teacher, 'first', 'révision.txt', text, revision);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.resources[0].id).toBe(publicFile.id);
    expect(
      (await upload(lessonId, teacher, 'first', 'révision.txt', 'Autre contenu', revision))
        .statusCode,
    ).toBe(409);
    expect((await upload(lessonId, teacher, 'stale', 'autre.txt', text, revision)).statusCode).toBe(
      409,
    );
    expect(
      (await upload(course.lessons[1].id, teacher, 'first', 'révision.txt', text)).statusCode,
    ).toBe(409);
    expect(await readdir(directory)).toHaveLength(1);
    const download = await call('GET', `/resources/${publicFile.id}/download`, teacher);
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload).toEqual(Buffer.from(text));
    expect(download.headers['content-disposition']).toContain("filename*=UTF-8''r%C3%A9vision.txt");
    expect(download.headers['x-content-type-options']).toBe('nosniff');
  });
  it('garde le brouillon privé et rattache chaque document au bon chapitre', async () => {
    const response = await upload(course.lessons[1].id, teacher, 'private', 'exercice.pdf', pdf);
    expect(response.statusCode).toBe(201);
    privateFile = response.json().data.resources[0];
    course.revision = response.json().data.courseRevision;
    expect((await call('GET', `/resources/${privateFile.id}/download`, other)).statusCode).toBe(
      404,
    );
    expect((await call('GET', `/resources/${privateFile.id}/download`, learner)).statusCode).toBe(
      404,
    );
    expect((await call('GET', `/resources/${publicFile.id}/download`, {})).statusCode).toBe(404);
    expect(
      (await call('GET', `/courses/${course.id}/lessons/${course.lessons[0].id}/resources`, {}))
        .statusCode,
    ).toBe(404);
    expect((await call('GET', address(course.lessons[0].id), other)).statusCode).toBe(404);
  });
  it('applique les droits du chapitre publié aux listes et aux téléchargements', async () => {
    const response = await call('PUT', `/teaching/courses/${course.id}/status`, teacher, {
      status: 'PUBLISHED',
      expectedRevision: course.revision,
    });
    expect(response.statusCode).toBe(200);
    course = response.json().data;
    expect((await call('GET', `/resources/${publicFile.id}/download`, {})).rawPayload).toEqual(
      Buffer.from(text),
    );
    expect((await call('GET', `/resources/${privateFile.id}/download`, {})).statusCode).toBe(401);
    const download = await call('GET', `/resources/${privateFile.id}/download`, learner);
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload).toEqual(Buffer.from(pdf));
    const publicList = await call(
      'GET',
      `/courses/${course.id}/lessons/${course.lessons[0].id}/resources`,
      {},
    );
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json().data[0].id).toBe(publicFile.id);
    expect(
      (await call('GET', `/courses/${course.id}/lessons/${course.lessons[1].id}/resources`, {}))
        .statusCode,
    ).toBe(401);
    const chapter = await call('GET', `/courses/${course.id}/lessons/${course.lessons[0].id}`, {});
    expect(chapter.json().data.resources[0].id).toBe(publicFile.id);
    expect(
      (await upload(course.lessons[0].id, teacher, 'published', 'fiche.txt', text)).statusCode,
    ).toBe(409);
    expect(
      (
        await call('DELETE', `${address(course.lessons[0].id)}/${publicFile.id}`, teacher, {
          expectedRevision: course.revision,
        })
      ).statusCode,
    ).toBe(409);
    course = (
      await call('PUT', `/teaching/courses/${course.id}/status`, teacher, {
        status: 'DRAFT',
        expectedRevision: course.revision,
      })
    ).json().data;
  });
  it('refuse les faux formats, fichiers vides, textes binaires et formulaires invalides', async () => {
    const lessonId = course.lessons[0].id;
    for (const [fileName, body] of [
      ['page.html', '<script>bad</script>'],
      ['faux.pdf', 'Un faux PDF'],
      ['vide.txt', ''],
    ]) {
      const response = await upload(lessonId, teacher, randomUUID(), fileName, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
    expect(
      (await upload(lessonId, teacher, 'binary', 'binaire.txt', new Uint8Array([0, 255, 0])))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call(
          'POST',
          address(lessonId),
          { ...teacher, 'idempotency-key': 'json' },
          { title: 'Sans fichier', expectedRevision: course.revision },
        )
      ).statusCode,
    ).toBe(400);
    expect((await call('GET', '/resources/invalid/download', {})).statusCode).toBe(400);
    expect(await readdir(directory)).toHaveLength(2);
  });
  it('borne la taille et accepte un document dépassant la limite habituelle du JSON', async () => {
    const lessonId = course.lessons[0].id;
    const tooLarge = await upload(
      lessonId,
      teacher,
      'large',
      'gros.txt',
      'a'.repeat(resourceLimit + 1),
    );
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.json().error.code).toBe('TOO_LARGE');
    const allowed = await upload(
      lessonId,
      teacher,
      'allowed-large',
      'texte.txt',
      'a'.repeat(2 * 1024 * 1024),
    );
    expect(allowed.statusCode).toBe(201);
    course.revision = allowed.json().data.courseRevision;
    expect(await readdir(directory)).toHaveLength(3);
  });
  it('refuse un retrait concurrent, masque le document retiré et conserve son fichier privé', async () => {
    const lessonId = course.lessons[0].id;
    expect(
      (
        await call('DELETE', `${address(lessonId)}/${publicFile.id}`, other, {
          expectedRevision: course.revision,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call('DELETE', `${address(course.lessons[1].id)}/${publicFile.id}`, teacher, {
          expectedRevision: course.revision,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call('DELETE', `${address(lessonId)}/${publicFile.id}`, teacher, {
          expectedRevision: 1,
        })
      ).statusCode,
    ).toBe(409);
    const response = await call('DELETE', `${address(lessonId)}/${publicFile.id}`, teacher, {
      expectedRevision: course.revision,
    });
    expect(response.statusCode).toBe(200);
    course.revision = response.json().data.courseRevision;
    expect(
      response.json().data.resources.some((resource: ResourceDto) => resource.id === publicFile.id),
    ).toBe(false);
    expect((await call('GET', `/resources/${publicFile.id}/download`, teacher)).statusCode).toBe(
      404,
    );
    expect(
      (
        await call('DELETE', `${address(lessonId)}/${publicFile.id}`, teacher, {
          expectedRevision: 1,
        })
      ).statusCode,
    ).toBe(200);
    expect((await upload(lessonId, teacher, 'first', 'révision.txt', text, 1)).statusCode).toBe(
      409,
    );
    expect(await readdir(directory)).toHaveLength(3);
    const stored = await pool.query('SELECT removed_at FROM resources WHERE id=$1', [
      publicFile.id,
    ]);
    expect(stored.rows[0].removed_at).not.toBeNull();
  });
  it('sérialise les ajouts concurrents et nettoie les fichiers des demandes refusées', async () => {
    const lessonId = course.lessons[0].id;
    const initialCount = (await readdir(directory)).length;
    const revision = course.revision;
    const repeated = await Promise.all([
      upload(lessonId, teacher, 'parallel-repeat', 'concurrent.txt', text, revision),
      upload(lessonId, teacher, 'parallel-repeat', 'concurrent.txt', text, revision),
    ]);
    expect(repeated.map((response) => response.statusCode)).toEqual([201, 201]);
    course.revision = repeated[0].json().data.courseRevision;
    expect(await readdir(directory)).toHaveLength(initialCount + 1);
    const concurrent = await Promise.all(
      ['one', 'two'].map((key) =>
        upload(lessonId, teacher, `parallel-${key}`, `${key}.txt`, text, course.revision),
      ),
    );
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(await readdir(directory)).toHaveLength(initialCount + 2);
  });
});
