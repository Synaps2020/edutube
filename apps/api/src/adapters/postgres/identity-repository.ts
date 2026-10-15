import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { profileSchema, type ProfileInput } from '@edutube/contracts/identity';
import type { IdentityRepository } from '../../application/identity';
import { DomainError } from '../../domain/errors';
export class PostgresIdentity implements IdentityRepository {
  constructor(private pool: Pool) {}
  private async transaction<Result>(work: (client: PoolClient) => Promise<Result>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async profile(accountId: string) {
    const result = await this.pool.query(
      `SELECT id,email,display_name AS "displayName",school_level AS "schoolLevel",biography,email_verified_at IS NOT NULL AS "emailVerified",profile_version AS version FROM accounts WHERE id=$1`,
      [accountId],
    );
    if (!result.rows[0]) {
      throw new DomainError('NOT_FOUND', 'Ce compte est introuvable.');
    }
    return profileSchema.parse(result.rows[0]);
  }
  async saveProfile(accountId: string, input: ProfileInput) {
    await this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE accounts SET display_name=$2,school_level=$3,biography=$4,profile_version=profile_version+1 WHERE id=$1 AND profile_version=$5 RETURNING id`,
        [accountId, input.displayName, input.schoolLevel, input.biography, input.expectedVersion],
      );
      if (!result.rowCount) {
        throw new DomainError(
          'REVISION_CONFLICT',
          'Votre profil a changé. Rechargez la page avant de réessayer.',
        );
      }
      await client.query('UPDATE instructors SET display_name=$2,biography=$3 WHERE id=$1', [
        accountId,
        input.displayName,
        input.biography,
      ]);
    });
    return this.profile(accountId);
  }
  async requestLink(
    target: { accountId?: string; email?: string },
    purpose: 'VERIFY' | 'RESET',
    tokenHash: string,
    link: string,
  ) {
    await this.transaction(async (client) => {
      const result = await client.query<{
        id: string;
        email: string;
        email_verified_at: Date | null;
      }>('SELECT id,email,email_verified_at FROM accounts WHERE id=$1 OR email=$2 FOR UPDATE', [
        target.accountId ?? null,
        target.email?.trim().toLowerCase() ?? null,
      ]);
      const account = result.rows[0];
      if (!account || (purpose === 'VERIFY' && account.email_verified_at)) {
        return;
      }
      const recent = await client.query(
        "SELECT 1 FROM account_tokens WHERE account_id=$1 AND purpose=$2 AND created_at>now()-interval '1 minute'",
        [account.id, purpose],
      );
      if (recent.rowCount) {
        return;
      }
      await client.query('DELETE FROM account_tokens WHERE account_id=$1 AND purpose=$2', [
        account.id,
        purpose,
      ]);
      await client.query(
        `INSERT INTO account_tokens(token_hash,account_id,purpose,expires_at) VALUES($1,$2,$3,now()+$4::interval)`,
        [tokenHash, account.id, purpose, purpose === 'VERIFY' ? '24 hours' : '30 minutes'],
      );
      const subject =
        purpose === 'VERIFY'
          ? 'EduTube — Vérifiez votre adresse e-mail'
          : 'EduTube — Nouveau mot de passe';
      const content = `${subject}\n\n${link}\n\nCe lien est utilisable une seule fois et expire dans ${purpose === 'VERIFY' ? '24 heures' : '30 minutes'}. Si vous n’avez pas fait cette demande, ignorez ce message.`;
      await client.query(
        'INSERT INTO mail_outbox(id,account_id,recipient,subject,content) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), account.id, account.email, subject, content],
      );
    });
  }
  async consume(tokenHash: string, purpose: 'VERIFY' | 'RESET', passwordHash?: string) {
    await this.transaction(async (client) => {
      const lookup = await client.query<{ account_id: string }>(
        'SELECT account_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2',
        [tokenHash, purpose],
      );
      const accountId = lookup.rows[0]?.account_id;
      if (!accountId) {
        throw new DomainError(
          'VALIDATION_ERROR',
          'Ce lien est invalide ou a expiré. Demandez un nouveau lien.',
        );
      }
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [accountId]);
      const result = await client.query(
        'DELETE FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING account_id',
        [tokenHash, purpose],
      );
      if (!result.rowCount) {
        throw new DomainError(
          'VALIDATION_ERROR',
          'Ce lien est invalide ou a expiré. Demandez un nouveau lien.',
        );
      }
      if (purpose === 'VERIFY') {
        await client.query(
          'UPDATE accounts SET email_verified_at=now(),profile_version=profile_version+1 WHERE id=$1',
          [accountId],
        );
      } else {
        await client.query('UPDATE accounts SET password_hash=$2 WHERE id=$1', [
          accountId,
          passwordHash,
        ]);
        await client.query('DELETE FROM sessions WHERE account_id=$1', [accountId]);
        await client.query("DELETE FROM account_tokens WHERE account_id=$1 AND purpose='RESET'", [
          accountId,
        ]);
      }
    });
  }
}
