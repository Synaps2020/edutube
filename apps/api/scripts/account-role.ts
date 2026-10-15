import { Pool } from 'pg';
import { z } from 'zod';
import { accountRoleSchema } from '@edutube/contracts/administration';
import { PostgresAdministration } from '../src/adapters/postgres/administration-repository';
import { PostgresAccounts } from '../src/adapters/postgres/account-repository';
const email = z.string().email().parse(process.argv[2]).trim().toLowerCase();
const role = accountRoleSchema.parse(process.argv[3]);
const reason = z.string().trim().min(10).max(1000).parse(process.argv[5]);
const pool = new Pool({ connectionString: z.string().url().parse(process.env.DATABASE_URL) });
try {
  const actorEmail = process.argv[4];
  if (actorEmail) {
    const actor = await new PostgresAccounts(pool).findByEmail(actorEmail.toLowerCase());
    if (!actor) {
      throw new Error('Le compte auteur est introuvable.');
    }
    const target = await pool.query<{
      id: string;
      admin_revision: number;
      suspended_at: Date | null;
    }>('SELECT id,admin_revision,suspended_at FROM accounts WHERE email=$1', [email]);
    if (!target.rows[0]) {
      throw new Error('Le compte à modifier est introuvable.');
    }
    await new PostgresAdministration(pool).changeAccount(
      { actor, requestId: 'maintenance-role' },
      target.rows[0].id,
      {
        role,
        suspended: !!target.rows[0].suspended_at,
        expectedRevision: target.rows[0].admin_revision,
        reason,
      },
    );
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('administration-comptes',0))",
      );
      const existing = await client.query("SELECT 1 FROM accounts WHERE role='SUPER_ADMIN'");
      if (existing.rowCount || role !== 'SUPER_ADMIN') {
        throw new Error(
          'Indiquez un super-admin auteur avec ACTOR. Seul le tout premier super-admin peut être initialisé sans auteur.',
        );
      }
      const changed = await client.query<{ id: string }>(
        "UPDATE accounts SET role='SUPER_ADMIN',admin_revision=admin_revision+1 WHERE email=$1 AND suspended_at IS NULL RETURNING id",
        [email],
      );
      if (!changed.rows[0]) {
        throw new Error('Créez d’abord ce compte et vérifiez qu’il est actif.');
      }
      await client.query('DELETE FROM sessions WHERE account_id=$1', [changed.rows[0].id]);
      await client.query(
        "INSERT INTO administration_audit(actor_name,action,target,reason,after_state,request_id) VALUES('Initialisation locale','BOOTSTRAP',$1,$2,$3,'maintenance-role')",
        [changed.rows[0].id, reason, JSON.stringify({ email, role })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(`Rôle ${role} attribué à ${email}. La modification est inscrite au journal.`);
} finally {
  await pool.end();
}
