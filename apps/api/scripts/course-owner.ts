import { Pool } from 'pg';
import { z } from 'zod';
import { idSchema } from '@edutube/contracts';
const courseId = idSchema.parse(process.argv[2]);
const email = z.string().email().parse(process.argv[3]).trim().toLowerCase();
const pool = new Pool({ connectionString: z.string().url().parse(process.env.DATABASE_URL) });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const account = await client.query<{ id: string; role: string }>(
    'SELECT id,role FROM accounts WHERE email=$1 FOR UPDATE',
    [email],
  );
  const teacher = account.rows[0];
  if (!teacher || !['TEACHER', 'ADMIN'].includes(teacher.role)) {
    throw new Error('Le compte doit déjà disposer du rôle enseignant ou administrateur.');
  }
  const before = await client.query(
    'SELECT owner_id,revision FROM courses WHERE id=$1 FOR UPDATE',
    [courseId],
  );
  const course = await client.query(
    'UPDATE courses SET owner_id=$2,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING revision',
    [courseId, teacher.id],
  );
  if (!course.rowCount) {
    throw new Error('Cours introuvable.');
  }
  await client.query(
    'INSERT INTO course_audit(course_id,account_id,action,revision) VALUES($1,$2,$3,$4)',
    [courseId, teacher.id, 'OWNER_ASSIGNED', course.rows[0].revision],
  );
  await client.query(
    `INSERT INTO administration_audit(actor_name,action,target,reason,before_state,after_state,request_id) VALUES('Maintenance locale','OWNER_ASSIGNED',$1,'Attribution du responsable depuis la commande de maintenance',$2,$3,'maintenance-owner')`,
    [
      courseId,
      JSON.stringify(before.rows[0]),
      JSON.stringify({ ownerId: teacher.id, revision: course.rows[0].revision }),
    ],
  );
  await client.query('COMMIT');
  console.log(
    `Le cours ${courseId} est désormais géré par ${email}. Son enseignant affiché reste inchangé.`,
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
