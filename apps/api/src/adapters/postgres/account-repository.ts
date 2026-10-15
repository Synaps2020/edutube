import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { AccountRepository, RegistrationMail } from '../../application/ports';
import type { Account } from '../../domain/account';
import { DomainError } from '../../domain/errors';
interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: Account['role'];
  school_level: Account['schoolLevel'];
}
function account(row: AccountRow): Account {
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    schoolLevel: row.school_level,
  };
}
export class PostgresAccounts implements AccountRepository {
  constructor(private pool: Pool) {}
  async findByEmail(email: string) {
    const result = await this.pool.query<AccountRow>(
      'SELECT * FROM accounts WHERE email=$1 AND suspended_at IS NULL',
      [email],
    );
    return result.rows[0] ? account(result.rows[0]) : null;
  }
  async create(value: Account, welcome?: RegistrationMail) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO accounts(id,email,display_name,password_hash,school_level) VALUES($1,$2,$3,$4,$5)',
        [value.id, value.email, value.displayName, value.passwordHash, value.schoolLevel],
      );
      if (welcome) {
        await client.query(
          "INSERT INTO account_tokens(token_hash,account_id,purpose,expires_at) VALUES($1,$2,'VERIFY',now()+interval '24 hours')",
          [welcome.tokenHash, value.id],
        );
        await client.query(
          'INSERT INTO mail_outbox(id,account_id,recipient,subject,content) VALUES($1,$2,$3,$4,$5)',
          [
            randomUUID(),
            value.id,
            value.email,
            'EduTube — Vérifiez votre adresse e-mail',
            `Bienvenue sur EduTube.\n\n${welcome.link}\n\nCe lien fonctionne une seule fois et expire dans 24 heures.`,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new DomainError('CONFLICT', 'Cette adresse e-mail est déjà utilisée.');
      }
      throw error;
    } finally {
      client.release();
    }
  }
  async saveSession(session: Parameters<AccountRepository['saveSession']>[0]) {
    await this.pool.query(
      'INSERT INTO sessions(token_hash,account_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)',
      [session.tokenHash, session.account.id, session.csrfToken, session.expiresAt],
    );
  }
  async findSession(tokenHash: string) {
    const result = await this.pool.query<
      AccountRow & { token_hash: string; csrf_token: string; expires_at: Date }
    >(
      `SELECT account.*, session.token_hash,session.csrf_token,session.expires_at FROM sessions session JOIN accounts account ON account.id=session.account_id WHERE session.token_hash=$1 AND session.expires_at>now() AND account.suspended_at IS NULL`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row
      ? {
          tokenHash: row.token_hash,
          account: account(row),
          csrfToken: row.csrf_token,
          expiresAt: row.expires_at.toISOString(),
        }
      : null;
  }
  async deleteSession(tokenHash: string) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]);
  }
}
