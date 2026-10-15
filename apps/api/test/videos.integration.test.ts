import { Teaching } from '../src/application/teaching';
import { PostgresTeaching } from '../src/adapters/postgres/teaching-repository';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Pool } from 'pg';
import { createServer } from '../src/adapters/http/server';
import { Catalog } from '../src/application/catalog';
import { Learning } from '../src/application/learning';
import { Authentication } from '../src/application/authentication';
import { Exercises } from '../src/application/exercises';
import { Videos } from '../src/application/videos';
import { ChapterAccess } from '../src/application/chapter-access';
import { VideoStorages, type VideoStorage } from '../src/application/video-storage';
import { PostgresChapterAccess } from '../src/adapters/postgres/chapter-access';
import { PostgresVideos } from '../src/adapters/postgres/video-repository';
import { PostgresCatalog } from '../src/adapters/postgres/catalog-repository';
import { PostgresLearning } from '../src/adapters/postgres/learning-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
import { PostgresQuizzes } from '../src/adapters/postgres/quiz-repository';
import { passwords, tokens } from '../src/adapters/security/credentials';
describe.runIf(!!process.env.DATABASE_URL)('Vidéos privées et examens PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const catalog = new PostgresCatalog(pool);
  const origin = 'http://localhost:3082';
  const courseId = `video-test-${randomUUID()}`;
  const firstId = `lesson-${randomUUID()}`;
  const secondId = `lesson-${randomUUID()}`;
  const quizId = `quiz-${randomUUID()}`;
  const videoId = randomUUID();
  const email = `video-${randomUUID()}@example.test`;
  let accountId: string;
  let headers: Record<string, string>;
  let server: Awaited<ReturnType<typeof createServer>>;
  const bytes = Buffer.from('0123456789');
  const storage: VideoStorage = {
    driver: 'memory-test',
    ready: async () => {},
    write: async (_key, source) => {
      for await (const _chunk of source) {
        /* Le stockage de test consomme le flux. */
      }
    },
    remove: async () => {},
    read: async (_key, range) =>
      Readable.from([range ? bytes.subarray(range.start, range.start + range.length) : bytes]),
  };
  beforeAll(async () => {
    const auth = new Authentication(new PostgresAccounts(pool), passwords, tokens);
    const registered = await auth.register({
      email,
      password: 'Mot-de-passe-video!',
      displayName: 'Élève vidéo',
    });
    accountId = registered.session.account.id;
    headers = {
      origin,
      cookie: `edutube_session=${registered.token}`,
      'x-csrf-token': registered.session.csrfToken,
    };
    await pool.query(
      `INSERT INTO courses(id,slug,title,short_description,description,subject_id,instructor_id,school_level,status,outcomes,palette,published_at) SELECT $1,$1,'Cours vidéo','Essai','Essai',subject_id,instructor_id,'SECONDARY','PUBLISHED',ARRAY['Apprendre'],'blue',now() FROM courses WHERE id='thales'`,
      [courseId],
    );
    await pool.query(
      `INSERT INTO lessons(id,course_id,title,position,kind,estimated_minutes,preview_allowed,requires_quiz,blocks) VALUES($1,$3,'Aperçu',0,'VIDEO',1,true,false,'[]'),($2,$3,'Suite protégée',1,'VIDEO',1,false,true,'[]')`,
      [firstId, secondId, courseId],
    );
    await pool.query(
      "INSERT INTO quizzes(id,course_id,title,passing_score) VALUES($1,$2,'Examen',70)",
      [quizId, courseId],
    );
    await pool.query(
      'INSERT INTO quiz_questions(id,quiz_id,position,prompt,options,correct_option_id,explanation) VALUES($1,$2,0,\'Deux plus deux ?\',\'[{"id":"correct","text":"Quatre"},{"id":"wrong","text":"Cinq"}]\',\'correct\',\'Quatre\')',
      [`question-${quizId}`, quizId],
    );
    for (const [index, lessonId] of [firstId, secondId].entries()) {
      const id = index === 0 ? videoId : randomUUID();
      await pool.query(
        "INSERT INTO lesson_videos(id,course_id,lesson_id,uploaded_by,storage_driver,source_key,file_name,size_bytes,status,request_key,request_hash) VALUES($1,$2,$3,$4,'memory-test','source','demo.mp4',10,'READY',$5,$6)",
        [id, courseId, lessonId, accountId, `fixture-${id}`, 'a'.repeat(64)],
      );
      await pool.query(
        "INSERT INTO video_assets(video_id,name,storage_key,media_type,size_bytes) VALUES($1,'0-00000.ts','segment','video/mp2t',10)",
        [id],
      );
    }
    const access = new ChapterAccess(new PostgresChapterAccess(pool));
    server = await createServer({
      teaching: new Teaching(new PostgresTeaching(pool)),
      authentication: auth,
      catalog: new Catalog(catalog),
      learning: new Learning(new PostgresLearning(pool), catalog),
      exercises: new Exercises(new PostgresQuizzes(pool)),
      videos: new Videos(
        new PostgresVideos(pool),
        new VideoStorages([storage], 'memory-test'),
        access,
      ),
      chapterAccess: access,
      origin,
      secureCookie: false,
      ready: async () => {
        await pool.query('SELECT 1');
      },
    });
  });
  afterAll(async () => {
    await server.close();
    await pool.query('DELETE FROM lesson_videos WHERE course_id=$1', [courseId]);
    await pool.query('DELETE FROM course_audit WHERE course_id=$1', [courseId]);
    await pool.query('UPDATE courses SET owner_id=NULL WHERE id=$1', [courseId]);
    await pool.query('DELETE FROM accounts WHERE id=$1', [accountId]);
    await pool.query('DELETE FROM courses WHERE id=$1', [courseId]);
    await pool.end();
  });
  const path = (lessonId: string) => `/api/v1/courses/${courseId}/lessons/${lessonId}`;
  it('permet l’aperçu et sert seulement les octets demandés', async () => {
    const response = await server.inject({
      url: path(firstId) + '/video/files/0-00000.ts',
      headers: { range: 'bytes=2-5' },
    });
    expect(response.statusCode).toBe(206);
    expect(response.body).toBe('2345');
    expect(response.headers['content-range']).toBe('bytes 2-5/10');
    expect(response.headers['content-length']).toBe('4');
  });
  it('renvoie 416 pour une plage impossible et refuse les chemins libres', async () => {
    expect(
      (
        await server.inject({
          url: path(firstId) + '/video/files/0-00000.ts',
          headers: { range: 'bytes=999-' },
        })
      ).statusCode,
    ).toBe(416);
    expect(
      (await server.inject({ url: path(firstId) + '/video/files/source.mp4' })).statusCode,
    ).toBe(400);
  });
  it('bloque le chapitre, ses segments et sa validation sans réussite', async () => {
    for (const suffix of ['', '/video', '/video/files/0-00000.ts']) {
      expect((await server.inject({ url: path(secondId) + suffix, headers })).statusCode).toBe(403);
    }
    expect(
      (
        await server.inject({
          method: 'PUT',
          url: `/api/v1/me/courses/${courseId}/lessons/${secondId}/progress`,
          headers,
          payload: { completed: true },
        })
      ).statusCode,
    ).toBe(403);
    const state = await server.inject({ url: `/api/v1/courses/${courseId}/access`, headers });
    expect(state.json().data.lessons[1].locked).toBe(true);
  });
  it('un examen échoué ne débloque rien', async () => {
    const result = await server.inject({
      method: 'POST',
      url: `/api/v1/me/quizzes/${quizId}/attempts`,
      headers: { ...headers, 'idempotency-key': 'failed-exam' },
      payload: {
        quizRevision: 1,
        answers: [{ questionId: `question-${quizId}`, optionId: 'wrong' }],
      },
    });
    expect(result.statusCode).toBe(201);
    expect((await server.inject({ url: path(secondId) + '/video', headers })).statusCode).toBe(403);
  });
  it('exige une inscription puis débloque après un résultat corrigé par le serveur', async () => {
    await server.inject({
      method: 'POST',
      url: '/api/v1/me/enrollments',
      headers: { ...headers, 'idempotency-key': 'enroll-video' },
      payload: { courseId },
    });
    const result = await server.inject({
      method: 'POST',
      url: `/api/v1/me/quizzes/${quizId}/attempts`,
      headers: { ...headers, 'idempotency-key': 'passed-exam' },
      payload: {
        quizRevision: 1,
        answers: [{ questionId: `question-${quizId}`, optionId: 'correct' }],
      },
    });
    expect(result.statusCode).toBe(201);
    expect((await server.inject({ url: path(secondId) + '/video', headers })).statusCode).toBe(200);
    expect(
      (await server.inject({ url: path(secondId) + '/video/files/0-00000.ts', headers })).body,
    ).toBe('0123456789');
  });
  it('une nouvelle version d’examen invalide l’ancienne réussite', async () => {
    await pool.query('UPDATE quizzes SET revision=revision+1 WHERE id=$1', [quizId]);
    expect(
      (await server.inject({ url: path(secondId) + '/video/files/0-00000.ts', headers }))
        .statusCode,
    ).toBe(403);
  });
  it('réserve les dépôts au propriétaire enseignant', async () => {
    const url = `/api/v1/teaching/courses/${courseId}/lessons/${firstId}/video`;
    expect((await server.inject({ method: 'POST', url, headers })).statusCode).toBe(403);
    await pool.query("UPDATE accounts SET role='TEACHER' WHERE id=$1", [accountId]);
    expect((await server.inject({ url, headers })).statusCode).toBe(404);
  });
  it('valide le MP4, dépose par flux, rejoue sans doublon et attend la préparation avant publication', async () => {
    await pool.query(
      "UPDATE courses SET owner_id=$2,status='DRAFT',illustration='geometry' WHERE id=$1",
      [courseId, accountId],
    );
    await pool.query(
      `UPDATE lessons SET blocks='[{"type":"PARAGRAPH","text":"Leçon de test."}]' WHERE course_id=$1`,
      [courseId],
    );
    const url = `/api/v1/teaching/courses/${courseId}/lessons/${firstId}/video`;
    expect(
      (await server.inject({ method: 'DELETE', url, headers, payload: { expectedRevision: 1 } }))
        .statusCode,
    ).toBe(200);
    const boundary = 'edutube-video-test';
    const multipart = (bytes: Buffer) =>
      Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="expectedRevision"\r\n\r\n2\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
    const requestHeaders = {
      ...headers,
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'idempotency-key': 'upload-video-test',
    };
    expect(
      (
        await server.inject({
          method: 'POST',
          url,
          headers: requestHeaders,
          payload: multipart(Buffer.from('ceci n’est pas une vidéo')),
        })
      ).statusCode,
    ).toBe(400);
    const bytes = Buffer.alloc(1200000);
    bytes.write('ftyp', 4, 'ascii');
    const first = await server.inject({
      method: 'POST',
      url,
      headers: requestHeaders,
      payload: multipart(bytes),
    });
    expect(first.statusCode).toBe(202);
    expect(first.json().data.video.sizeBytes).toBe(bytes.length);
    const replay = await server.inject({
      method: 'POST',
      url,
      headers: requestHeaders,
      payload: multipart(bytes),
    });
    expect(replay.statusCode).toBe(202);
    expect(replay.json().data.video.id).toBe(first.json().data.video.id);
    expect(
      (
        await server.inject({
          method: 'PUT',
          url: `/api/v1/teaching/courses/${courseId}/status`,
          headers,
          payload: { expectedRevision: 3, status: 'PUBLISHED' },
        })
      ).statusCode,
    ).toBe(409);
  });
});
