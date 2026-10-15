import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresQuizzes } from '../src/adapters/postgres/quiz-repository';
import { Exercises } from '../src/application/exercises';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { passwords } from '../src/adapters/security/credentials';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV === 'production') {
  throw new Error('Les comptes de test sont réservés au développement.');
}
const accounts = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'eleve@edutube.test',
    name: 'Aminata Diop',
    role: 'LEARNER',
    level: 'MIDDLE',
    verified: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    email: 'enseignant@edutube.test',
    name: 'Moussa Ndiaye',
    role: 'TEACHER',
    level: null,
    verified: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    email: 'admin@edutube.test',
    name: 'Fatou Diop',
    role: 'ADMIN',
    level: null,
    verified: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    email: 'nouveau@edutube.test',
    name: 'Ibrahima Sow',
    role: 'LEARNER',
    level: 'SECONDARY',
    verified: false,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    email: 'superadmin@edutube.test',
    name: 'Awa Ndiaye',
    role: 'SUPER_ADMIN',
    level: null,
    verified: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    email: 'regulateur@edutube.test',
    name: 'Omar Ba',
    role: 'REGULATOR',
    level: null,
    verified: true,
  },
];
const client = await pool.connect();
try {
  const passwordHash = await passwords.hash('EduTube-Test2026!');
  await client.query('BEGIN');
  await client.query(
    await readFile(new URL('../../../db/fixtures/catalogue.sql', import.meta.url), 'utf8'),
  );
  for (const account of accounts) {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM accounts WHERE email=$1 OR id=$2',
      [account.email, account.id],
    );
    if (existing.rows.some((record) => record.id !== account.id)) {
      throw new Error(`Adresse déjà utilisée hors des exemples : ${account.email}`);
    }
    await client.query(
      `INSERT INTO accounts(id,email,display_name,password_hash,role,school_level,email_verified_at,biography) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7 THEN now() ELSE NULL END,$8) ON CONFLICT(id) DO NOTHING`,
      [
        account.id,
        account.email,
        account.name,
        passwordHash,
        account.role,
        account.level,
        account.verified,
        'Compte pédagogique de test.',
      ],
    );
  }
  await client.query(`INSERT INTO administration_audit(actor_name,action,target,reason,after_state,request_id)
    SELECT 'Données de démonstration','BOOTSTRAP',id::text,'Création des comptes de démonstration',jsonb_build_object('role',role,'email',email),'seed-demo'
    FROM accounts WHERE id IN ('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006')
    AND NOT EXISTS(SELECT 1 FROM administration_audit audit WHERE audit.target=accounts.id::text AND audit.request_id='seed-demo')`);
  await client.query(
    "UPDATE courses SET owner_id=$1 WHERE id IN ('thales','photosynthese','fractions','code') AND owner_id IS NULL",
    [accounts[1].id],
  );
  await client.query(
    "UPDATE courses SET owner_id=$1 WHERE id IN ('expression','lecture') AND owner_id IS NULL",
    [accounts[2].id],
  );
  for (const courseId of ['thales', 'photosynthese', 'expression']) {
    await client.query(
      'INSERT INTO enrollments(id,account_id,course_id) VALUES(gen_random_uuid(),$1,$2) ON CONFLICT DO NOTHING',
      [accounts[0].id, courseId],
    );
  }
  await client.query(
    "INSERT INTO favorites(account_id,course_id) VALUES($1,'code'),($1,'thales') ON CONFLICT DO NOTHING",
    [accounts[0].id],
  );
  await client.query(
    "INSERT INTO lesson_completions(account_id,course_id,lesson_id) SELECT $1,course_id,id FROM lessons WHERE course_id='thales' AND position=0 ON CONFLICT DO NOTHING",
    [accounts[0].id],
  );
  await client.query(
    "INSERT INTO notes(id,account_id,course_id,lesson_id,text) SELECT gen_random_uuid(),$1,course_id,id,'Pour appliquer Thalès : repérer les droites parallèles et les triangles, puis écrire les rapports dans le même ordre.' FROM lessons WHERE course_id='thales' AND position=1 ON CONFLICT DO NOTHING",
    [accounts[0].id],
  );
  await client.query(
    "INSERT INTO learning_resume(account_id,course_id,lesson_id) SELECT $1,course_id,id FROM lessons WHERE course_id='thales' AND position=1 ON CONFLICT DO NOTHING",
    [accounts[0].id],
  );
  await client.query(
    `INSERT INTO courses(id,slug,title,short_description,description,subject_id,instructor_id,school_level,status,outcomes,prerequisites,palette,illustration,owner_id)
    SELECT 'demo-brouillon','demo-brouillon','Les équations, pas à pas','Un cours en préparation pour organiser ses calculs.','Un brouillon pour tester la création des chapitres et des quiz.',subject_id,instructor_id,school_level,'DRAFT',outcomes,prerequisites,palette,illustration,$1 FROM courses WHERE id='thales' ON CONFLICT DO NOTHING`,
    [accounts[1].id],
  );
  await client.query(
    `INSERT INTO lessons(id,course_id,title,position,kind,estimated_minutes,preview_allowed,blocks) VALUES('demo-equations-1','demo-brouillon','Découvrir les équations',0,'READING',15,true,'[{"type":"PARAGRAPH","text":"Une équation est une égalité contenant une inconnue."}]') ON CONFLICT DO NOTHING`,
  );
  const storage = resolve(
    fileURLToPath(new URL('../../../', import.meta.url)),
    process.env.STORAGE_DIR ?? 'data/resources',
  );
  await mkdir(storage, { recursive: true, mode: 0o700 });
  const resourceId = '20000000-0000-4000-8000-000000000001';
  const bytes = Buffer.from(
    'Fiche de révision — Thalès\n\nRepérez les droites parallèles. Écrivez les rapports correspondants dans le même ordre. Isolez ensuite la longueur inconnue.\n',
  );
  try {
    await writeFile(resolve(storage, resourceId), bytes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') {
      throw error;
    }
  }
  await client.query(
    `INSERT INTO resources(id,course_id,lesson_id,title,file_name,media_type,size_bytes,storage_key,uploaded_by,request_key,request_hash)
    SELECT $1,course_id,id,'Fiche de révision — Thalès','fiche-thales.txt','text/plain',$2,$1,$3,'demo-fiche-thales',$4 FROM lessons WHERE course_id='thales' AND position=0 ON CONFLICT DO NOTHING`,
    [resourceId, bytes.length, accounts[1].id, createHash('sha256').update(bytes).digest('hex')],
  );
  const draftResource = '20000000-0000-4000-8000-000000000002';
  const draftBytes = Buffer.from(
    'Exercices — Équations\n\nRésoudre : x + 5 = 12, puis 3x = 21.\nVérifier chaque solution en remplaçant x dans l’égalité de départ.\nSolutions : x = 7 dans les deux cas.\n',
  );
  try {
    await writeFile(resolve(storage, draftResource), draftBytes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') {
      throw error;
    }
  }
  await client.query(
    `INSERT INTO resources(id,course_id,lesson_id,title,file_name,media_type,size_bytes,storage_key,uploaded_by,request_key,request_hash) VALUES($1,'demo-brouillon','demo-equations-1','Exercice de préparation','exercice.txt','text/plain',$2,$1,$3,'demo-fiche-equations',$4) ON CONFLICT DO NOTHING`,
    [
      draftResource,
      draftBytes.length,
      accounts[1].id,
      createHash('sha256').update(draftBytes).digest('hex'),
    ],
  );
  await client.query('COMMIT');
  const quizzes = new PostgresQuizzes(pool);
  const quiz = await quizzes.findByCourse('thales');
  const attempt = quiz
    ? await pool.query(
        'SELECT 1 FROM quiz_attempts WHERE account_id=$1 AND quiz_id=$2 AND request_key=$3',
        [accounts[0].id, quiz.id, 'demo-quiz-thales'],
      )
    : null;
  if (quiz && !attempt?.rowCount) {
    await new Exercises(quizzes).submit(
      accounts[0].id,
      quiz.id,
      {
        quizRevision: quiz.revision,
        answers: quiz.questions.map((question) => ({
          questionId: question.id,
          optionId: question.correctOptionId,
        })),
      },
      'demo-quiz-thales',
    );
  }
  console.log(
    'Six comptes de test sont prêts, avec des cours, favoris, notes et progression. Les comptes existants sont conservés. Accès dans le README.',
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
