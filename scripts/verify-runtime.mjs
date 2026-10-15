import assert from 'node:assert/strict';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.TEST_PASSWORD;
const origin = process.env.TEST_ORIGIN ?? 'http://localhost:3082';
assert(databaseUrl && password, 'DATABASE_URL et TEST_PASSWORD sont nécessaires.');
assert(
  ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
  'Utiliser un serveur local de test.',
);
const pool = new Pool({ connectionString: databaseUrl });
let checks = 0;
function verify(condition, message) {
  assert(condition, message);
  checks++;
}
async function request(path, session, options = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    signal: AbortSignal.timeout(10000),
    ...options,
    headers: {
      origin,
      ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrfToken } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, data: body?.data };
}
try {
  const migrations = await pool.query('SELECT success FROM flyway_schema_history');
  verify(
    migrations.rows.length >= 11 && migrations.rows.every((row) => row.success),
    'Migrations incomplètes.',
  );
  const integrity = await pool.query(`
    SELECT 'chapitre sans examen' AS problem, l.id FROM lessons l
    WHERE l.requires_quiz AND NOT EXISTS (SELECT 1 FROM quizzes q JOIN quiz_questions qq ON qq.quiz_id=q.id WHERE q.course_id=l.course_id)
    UNION ALL
    SELECT 'vidéo publiée indisponible', l.id FROM lessons l JOIN courses c ON c.id=l.course_id
    WHERE c.status='PUBLISHED' AND l.kind='VIDEO' AND NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id=l.id AND v.status='READY')
    UNION ALL
    SELECT 'réponse de quiz absente', q.id FROM quiz_questions q
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q.options) option WHERE option->>'id'=q.correct_option_id)
    UNION ALL
    SELECT 'cours publié sans chapitre', c.id FROM courses c WHERE c.status='PUBLISHED' AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.course_id=c.id)
    UNION ALL
    SELECT 'vidéo prête sans manifeste', v.id::text FROM lesson_videos v WHERE v.status='READY' AND NOT EXISTS (SELECT 1 FROM video_assets a WHERE a.video_id=v.id AND a.name='master.m3u8')
  `);
  verify(integrity.rowCount === 0, `Incohérences : ${JSON.stringify(integrity.rows)}`);
  const foreignKeys = await pool.query(
    "SELECT conname FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND NOT convalidated",
  );
  verify(foreignKeys.rowCount === 0, 'Clés étrangères non validées.');
  const catalog = await request('/courses?pageSize=100');
  verify(catalog.response.ok, 'Catalogue indisponible via le front.');
  const published = await pool.query(
    "SELECT id,title FROM courses WHERE status='PUBLISHED' AND moderation='CLEAR' ORDER BY id",
  );
  verify(
    JSON.stringify(
      catalog.data.items
        .map(({ id, title }) => ({ id, title }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ) === JSON.stringify(published.rows),
    'Catalogue différent de PostgreSQL.',
  );
  verify((await request('/me/profile')).response.status === 401, 'Profil accessible sans session.');
  const previews = await pool.query(
    "SELECT v.course_id,v.lesson_id FROM lesson_videos v JOIN lessons l ON l.id=v.lesson_id JOIN courses c ON c.id=v.course_id WHERE v.status='READY' AND l.preview_allowed AND c.status='PUBLISHED'",
  );
  verify(previews.rowCount > 0, 'Aucune vidéo de démonstration en aperçu.');
  for (const preview of previews.rows) {
    const video = await request(`/courses/${preview.course_id}/lessons/${preview.lesson_id}/video`);
    verify(video.response.ok && video.data.status === 'READY', 'Aperçu vidéo indisponible.');
    const manifest = await fetch(new URL(video.data.playbackUrl, origin));
    verify(
      manifest.ok && (await manifest.text()).startsWith('#EXTM3U'),
      'Manifeste HLS absent du stockage.',
    );
    const asset = await pool.query(
      "SELECT name,size_bytes FROM video_assets WHERE video_id=$1 AND media_type='video/mp2t' LIMIT 1",
      [video.data.id],
    );
    verify(asset.rowCount === 1, 'Segment vidéo manquant.');
    const fileUrl = video.data.playbackUrl.replace('master.m3u8', asset.rows[0].name);
    const segment = await fetch(new URL(fileUrl, origin), { headers: { range: 'bytes=0-15' } });
    verify(
      segment.status === 206 &&
        (await segment.arrayBuffer()).byteLength === 16 &&
        segment.headers.get('content-range') === `bytes 0-15/${asset.rows[0].size_bytes}`,
      'Lecture partielle du stockage incorrecte.',
    );
  }
  const accounts = await pool.query(
    "SELECT id,email,role,display_name FROM accounts WHERE email IN ('eleve@edutube.test','nouveau@edutube.test','enseignant@edutube.test','admin@edutube.test','superadmin@edutube.test','regulateur@edutube.test') ORDER BY email",
  );
  verify(accounts.rowCount === 6, 'Comptes de démonstration incomplets.');
  for (const account of accounts.rows) {
    const login = await request('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email: account.email, password }),
    });
    verify(
      login.response.ok &&
        login.data.learner.id === account.id &&
        login.data.learner.role === account.role,
      `Connexion incorrecte : ${account.role} (HTTP ${login.response.status}).`,
    );
    const session = {
      cookie: login.response.headers.get('set-cookie').split(';')[0],
      csrfToken: login.data.csrfToken,
    };
    try {
      const profile = await request('/me/profile', session);
      verify(
        profile.response.ok &&
          profile.data.displayName === account.display_name &&
          profile.data.email === account.email,
        `Profil différent de PostgreSQL : ${account.role}.`,
      );
      verify(
        (await request('/auth/session', session)).data.learner.id === account.id,
        'Session incorrecte.',
      );
      const isModerator = ['SUPER_ADMIN', 'REGULATOR'].includes(account.role);
      verify(
        (await request('/administration/overview', session)).response.status ===
          (isModerator ? 200 : 403),
        `Droits administration incorrects : ${account.role}.`,
      );
      verify(
        (await request('/administration/accounts', session)).response.status ===
          (account.role === 'SUPER_ADMIN' ? 200 : 403),
        `Droits comptes incorrects : ${account.role}.`,
      );
      verify(
        (await request('/teaching/courses', session)).response.status ===
          (['TEACHER', 'ADMIN'].includes(account.role) ? 200 : 403),
        `Droits enseignant incorrects : ${account.role}.`,
      );
      const enrollments = await request('/me/enrollments?pageSize=100', session);
      const stored = await pool.query('SELECT course_id FROM enrollments WHERE account_id=$1', [
        account.id,
      ]);
      verify(
        enrollments.response.ok && enrollments.data.pagination.total === stored.rowCount,
        `Inscriptions différentes : ${account.role}.`,
      );
      const forbidden = await request('/me/favorites/thales', session, {
        method: 'PUT',
        headers: { 'x-csrf-token': 'incorrect' },
      });
      verify(forbidden.response.status === 403, 'Protection CSRF absente.');
      if (account.email === 'nouveau@edutube.test') {
        const courseId = catalog.data.items[0].id;
        const original = await pool.query(
          'SELECT 1 FROM favorites WHERE account_id=$1 AND course_id=$2',
          [account.id, courseId],
        );
        if (original.rowCount === 0) {
          try {
            verify(
              (await request(`/me/favorites/${courseId}`, session, { method: 'PUT' })).response.ok,
              'Favori non enregistré par HTTP.',
            );
            const saved = await pool.query(
              'SELECT 1 FROM favorites WHERE account_id=$1 AND course_id=$2',
              [account.id, courseId],
            );
            verify(saved.rowCount === 1, 'Écriture HTTP absente de PostgreSQL.');
            const favorites = await request('/me/favorites?pageSize=100', session);
            verify(
              favorites.data.items.some((item) => item.course.id === courseId),
              'Favori absent lors de la relecture HTTP.',
            );
          } finally {
            verify(
              (await request(`/me/favorites/${courseId}`, session, { method: 'DELETE' })).response
                .ok,
              'Nettoyage du favori impossible.',
            );
            const removed = await pool.query(
              'SELECT 1 FROM favorites WHERE account_id=$1 AND course_id=$2',
              [account.id, courseId],
            );
            verify(removed.rowCount === 0, 'Retrait HTTP non persisté.');
          }
        }
        const gated = await pool.query(
          "SELECT l.course_id,l.id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.requires_quiz AND c.status='PUBLISHED' LIMIT 1",
        );
        if (gated.rowCount) {
          const lesson = gated.rows[0];
          verify(
            (await request(`/courses/${lesson.course_id}/lessons/${lesson.id}/video`, session))
              .response.status === 403,
            'Examen contourné par une URL vidéo directe.',
          );
        }
      }
      console.log(`✓ ${account.role} : connexion, profil, inscriptions et permissions`);
    } finally {
      verify(
        (await request('/auth/logout', session, { method: 'POST' })).response.ok,
        'Déconnexion impossible.',
      );
      verify(
        (await request('/auth/session', session)).response.status === 401,
        'Session encore valide après déconnexion.',
      );
    }
  }
  console.log(`✓ ${checks} contrôles sur le serveur démarré, via ${origin}, et PostgreSQL`);
} finally {
  await pool.end();
}
