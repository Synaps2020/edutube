import { loadTeachingCourse } from './teaching-repository';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  adminOverviewSchema,
  adminAccountSchema,
  adminCourseSchema,
  auditEntrySchema,
  type AdminQuery,
  type AccountChange,
  type AccountCreate,
  type Moderation,
} from '@edutube/contracts/administration';
import {
  requireAdministrator,
  type AdministrationRepository,
  type AdminContext,
} from '../../application/administration';
import { DomainError } from '../../domain/errors';
import type { Account } from '../../domain/account';
const accountColumns = `id,email,display_name AS "displayName",role,(suspended_at IS NOT NULL) AS suspended,(email_verified_at IS NOT NULL) AS verified,admin_revision AS revision`;
const courseColumns = `course.id,course.title,account.display_name AS owner,course.status,course.moderation,course.revision,course.palette,course.illustration,course.school_level AS "schoolLevel",(SELECT name FROM subjects WHERE id=course.subject_id) AS subject,
 (SELECT count(*)::int FROM lessons WHERE course_id=course.id) AS "lessonCount",
 (SELECT coalesce(sum(estimated_minutes),0)::int FROM lessons WHERE course_id=course.id) AS "durationMinutes",
 (SELECT count(*)::int FROM enrollments WHERE course_id=course.id) AS learners,
 to_char(course.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"`;
const accountFilters: Record<string, string> = {
  active: 'suspended_at IS NULL',
  suspended: 'suspended_at IS NOT NULL',
  unverified: 'email_verified_at IS NULL',
  LEARNER: "role='LEARNER'",
  TEACHER: "role IN ('TEACHER','ADMIN')",
  ADMIN: "role='ADMIN'",
  REGULATOR: "role='REGULATOR'",
  SUPER_ADMIN: "role='SUPER_ADMIN'",
};
const courseFilters: Record<string, string> = {
  PUBLISHED: "course.status='PUBLISHED'",
  DRAFT: "course.status='DRAFT'",
  ARCHIVED: "course.status='ARCHIVED'",
  moderated: "course.moderation<>'CLEAR'",
  video_failed:
    "EXISTS(SELECT 1 FROM lesson_videos video WHERE video.course_id=course.id AND video.status='FAILED')",
  video_processing:
    "EXISTS(SELECT 1 FROM lesson_videos video WHERE video.course_id=course.id AND video.status IN ('QUEUED','PROCESSING'))",
  video_ready:
    "EXISTS(SELECT 1 FROM lesson_videos video WHERE video.course_id=course.id AND video.status='READY')",
};
export class PostgresAdministration implements AdministrationRepository {
  constructor(private pool: Pool) {}
  private async transaction<Result>(
    context: AdminContext,
    manageAccounts: boolean,
    action: (client: PoolClient) => Promise<Result>,
    lockAccounts = false,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (lockAccounts) {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('administration-comptes',0))",
        );
      }
      const actor = await client.query<{ role: Account['role']; suspended_at: Date | null }>(
        'SELECT role,suspended_at FROM accounts WHERE id=$1 FOR SHARE',
        [context.actor.id],
      );
      if (!actor.rows[0] || actor.rows[0].suspended_at) {
        throw new DomainError('FORBIDDEN', 'Ce compte ne peut plus administrer la plateforme.');
      }
      requireAdministrator({ ...context.actor, role: actor.rows[0].role }, manageAccounts);
      context.actor = { ...context.actor, role: actor.rows[0].role };
      const result = await action(client);
      await client.query('COMMIT');
      return result;
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
  private async audit(
    client: PoolClient | Pool,
    context: AdminContext,
    action: string,
    target: string,
    reason: string,
    before: unknown = null,
    after: unknown = null,
  ) {
    await client.query(
      `INSERT INTO administration_audit(actor_id,actor_name,action,target,reason,before_state,after_state,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        context.actor.id,
        `${context.actor.displayName} <${context.actor.email}>`,
        action,
        target,
        reason,
        before === null ? null : JSON.stringify(before),
        after === null ? null : JSON.stringify(after),
        context.requestId,
      ],
    );
  }
  rejected(context: AdminContext, target: string, code: string) {
    return this.audit(this.pool, context, 'ACTION_REJECTED', target, 'Intervention refusée', null, {
      code,
    });
  }
  overview(context: AdminContext) {
    return this.transaction(context, false, async (client) => {
      const scope = context.actor.role === 'SUPER_ADMIN' ? null : context.actor.id;
      const result = await client.query(
        `SELECT
        CASE WHEN $1::uuid IS NULL THEN (SELECT json_build_object('total',count(*),'active',count(*) FILTER(WHERE suspended_at IS NULL),'suspended',count(*) FILTER(WHERE suspended_at IS NOT NULL),'unverified',count(*) FILTER(WHERE email_verified_at IS NULL),'teachers',count(*) FILTER(WHERE role IN ('TEACHER','ADMIN')),'regulators',count(*) FILTER(WHERE role='REGULATOR')) FROM accounts) ELSE NULL END AS accounts,
        (SELECT json_build_object('total',count(*),'published',count(*) FILTER(WHERE status='PUBLISHED'),'draft',count(*) FILTER(WHERE status='DRAFT'),'archived',count(*) FILTER(WHERE status='ARCHIVED'),'withdrawn',count(*) FILTER(WHERE moderation='WITHDRAWN'),'deleted',count(*) FILTER(WHERE moderation='DELETED')) FROM courses) AS courses,
        (SELECT json_build_object('ready',count(*) FILTER(WHERE status='READY'),'processing',count(*) FILTER(WHERE status IN ('QUEUED','PROCESSING')),'failed',count(*) FILTER(WHERE status='FAILED')) FROM lesson_videos WHERE status<>'REMOVED') AS videos,
        json_build_object('enrollments',(SELECT count(*) FROM enrollments),'completions',(SELECT count(*) FROM lesson_completions)) AS learning,
        (SELECT json_agg(json_build_object('date',day::date::text,'changes',(SELECT count(*) FROM administration_audit audit WHERE audit.created_at>=day AND audit.created_at<day+interval '1 day' AND ($1::uuid IS NULL OR actor_id=$1) AND action IN ('ACCOUNT_CHANGED','ACCOUNT_CREATED','COURSE_WITHDRAW','COURSE_DELETE','COURSE_RESTORE')),'reviews',(SELECT count(*) FROM administration_audit audit WHERE audit.created_at>=day AND audit.created_at<day+interval '1 day' AND ($1::uuid IS NULL OR actor_id=$1) AND action='COURSE_REVIEWED')) ORDER BY day) FROM generate_series(current_date-6,current_date,interval '1 day') day) AS activity,
        (SELECT coalesce(json_agg(record),'[]'::json) FROM (SELECT id::text,actor_name AS actor,action,target,reason,before_state AS before,after_state AS after,created_at AS "createdAt",request_id AS "requestId" FROM administration_audit WHERE ($1::uuid IS NULL OR actor_id=$1) AND action IN ('ACCOUNT_CHANGED','ACCOUNT_CREATED','COURSE_WITHDRAW','COURSE_DELETE','COURSE_RESTORE','COURSE_REVIEWED','ACTION_REJECTED','BOOTSTRAP') ORDER BY created_at DESC,administration_audit.id DESC LIMIT 6) record) AS recent,
        now() AS updated_at`,
        [scope],
      );
      const row = result.rows[0];
      const overview = adminOverviewSchema.parse({
        ...row,
        updatedAt: row.updated_at.toISOString(),
      });
      await this.audit(
        client,
        context,
        'OVERVIEW_READ',
        'tableau-de-bord',
        'Consultation du tableau de bord',
      );
      return overview;
    });
  }
  review(context: AdminContext, id: string) {
    return this.transaction(context, false, async (client) => {
      await client.query('SELECT id FROM courses WHERE id=$1 FOR SHARE', [id]);
      const course = await loadTeachingCourse(client, null, id);
      await this.audit(client, context, 'COURSE_REVIEWED', id, 'Vérification du contenu du cours');
      return course;
    });
  }
  readMedia(context: AdminContext, target: string) {
    return this.transaction(context, false, async (client) => {
      await this.audit(
        client,
        context,
        'MEDIA_REVIEWED',
        target,
        'Vérification d’un média du cours',
      );
    });
  }
  accounts(context: AdminContext, query: AdminQuery) {
    return this.transaction(context, true, async (client) => {
      const filter = `%${query.query}%`;
      const result = await client.query(
        `SELECT ${accountColumns} FROM accounts WHERE (email ILIKE $1 OR display_name ILIKE $1) AND ${accountFilters[query.filter ?? 'all'] ?? 'true'} ORDER BY display_name,id LIMIT 25 OFFSET $2`,
        [filter, (query.page - 1) * 25],
      );
      const count = await client.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM accounts WHERE (email ILIKE $1 OR display_name ILIKE $1) AND ${accountFilters[query.filter ?? 'all'] ?? 'true'}`,
        [filter],
      );
      await this.audit(
        client,
        context,
        'ACCOUNTS_READ',
        'comptes',
        'Consultation des comptes',
        null,
        query,
      );
      return {
        items: result.rows.map((row) => adminAccountSchema.parse(row)),
        total: count.rows[0].total,
      };
    });
  }
  courses(context: AdminContext, query: AdminQuery) {
    return this.transaction(context, false, async (client) => {
      const filter = `%${query.query}%`;
      const result = await client.query(
        `SELECT ${courseColumns} FROM courses course LEFT JOIN accounts account ON account.id=course.owner_id WHERE course.title ILIKE $1 AND ${courseFilters[query.filter ?? 'all'] ?? 'true'} ORDER BY course.updated_at DESC,course.id LIMIT 25 OFFSET $2`,
        [filter, (query.page - 1) * 25],
      );
      const count = await client.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM courses course WHERE course.title ILIKE $1 AND ${courseFilters[query.filter ?? 'all'] ?? 'true'}`,
        [filter],
      );
      await this.audit(
        client,
        context,
        'COURSES_READ',
        'cours',
        'Consultation des contenus',
        null,
        query,
      );
      return {
        items: result.rows.map((row) => adminCourseSchema.parse(row)),
        total: count.rows[0].total,
      };
    });
  }
  journal(context: AdminContext, query: AdminQuery) {
    return this.transaction(context, false, async (client) => {
      const scope = context.actor.role === 'SUPER_ADMIN' ? null : context.actor.id;
      const result = await client.query(
        `SELECT id::text,actor_name AS actor,action,target,reason,before_state AS before,after_state AS after,created_at,request_id AS "requestId" FROM administration_audit WHERE ($1::uuid IS NULL OR actor_id=$1) AND (actor_name ILIKE $2 OR target ILIKE $2 OR action ILIKE $2) ORDER BY administration_audit.created_at DESC,administration_audit.id DESC LIMIT 25 OFFSET $3`,
        [scope, `%${query.query}%`, (query.page - 1) * 25],
      );
      const count = await client.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM administration_audit WHERE ($1::uuid IS NULL OR actor_id=$1) AND (actor_name ILIKE $2 OR target ILIKE $2 OR action ILIKE $2)',
        [scope, `%${query.query}%`],
      );
      await this.audit(
        client,
        context,
        'JOURNAL_READ',
        'journal',
        'Consultation du journal',
        null,
        query,
      );
      return {
        items: result.rows.map((row) =>
          auditEntrySchema.parse({ ...row, createdAt: row.created_at.toISOString() }),
        ),
        total: count.rows[0].total,
      };
    });
  }
  changeAccount(context: AdminContext, id: string, input: AccountChange) {
    return this.transaction(
      context,
      true,
      async (client) => {
        const result = await client.query(
          `SELECT ${accountColumns} FROM accounts WHERE id=$1 FOR UPDATE`,
          [id],
        );
        if (!result.rows[0]) {
          throw new DomainError('NOT_FOUND', 'Ce compte est introuvable.');
        }
        const before = adminAccountSchema.parse(result.rows[0]);
        if (before.revision !== input.expectedRevision) {
          throw new DomainError('REVISION_CONFLICT', 'Ce compte a changé. Actualisez la liste.');
        }
        if (id === context.actor.id && (input.suspended || input.role !== 'SUPER_ADMIN')) {
          throw new DomainError(
            'CONFLICT',
            'Vous ne pouvez pas retirer vos propres droits ni suspendre votre compte.',
          );
        }
        if (
          before.role === 'SUPER_ADMIN' &&
          !before.suspended &&
          (input.suspended || input.role !== 'SUPER_ADMIN')
        ) {
          const count = await client.query<{ total: number }>(
            "SELECT count(*)::int AS total FROM accounts WHERE role='SUPER_ADMIN' AND suspended_at IS NULL",
          );
          if (count.rows[0].total <= 1) {
            throw new DomainError('CONFLICT', 'Conservez au moins un super-admin actif.');
          }
        }
        const changed = await client.query(
          `UPDATE accounts SET role=$2,suspended_at=CASE WHEN $3 THEN coalesce(suspended_at,now()) ELSE NULL END,admin_revision=admin_revision+1 WHERE id=$1 RETURNING ${accountColumns}`,
          [id, input.role, input.suspended],
        );
        await client.query('DELETE FROM sessions WHERE account_id=$1', [id]);
        const after = adminAccountSchema.parse(changed.rows[0]);
        await this.audit(client, context, 'ACCOUNT_CHANGED', id, input.reason, before, after);
        return after;
      },
      true,
    );
  }
  createAccount(
    context: AdminContext,
    input: AccountCreate,
    passwordHash: string,
    tokenHash: string,
    link: string,
  ) {
    return this.transaction(
      context,
      true,
      async (client) => {
        const id = randomUUID();
        const result = await client.query(
          `INSERT INTO accounts(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING ${accountColumns}`,
          [id, input.email.toLowerCase(), input.displayName, passwordHash, input.role],
        );
        await client.query(
          "INSERT INTO account_tokens(token_hash,account_id,purpose,expires_at) VALUES($1,$2,'RESET',now()+interval '30 minutes')",
          [tokenHash, id],
        );
        await client.query(
          'INSERT INTO mail_outbox(id,account_id,recipient,subject,content) VALUES($1,$2,$3,$4,$5)',
          [
            randomUUID(),
            id,
            input.email.toLowerCase(),
            'EduTube — Votre invitation',
            `Votre compte EduTube est prêt. Choisissez votre mot de passe avec ce lien valable 30 minutes :\n\n${link}\n\nDemandez un nouveau lien depuis « Mot de passe oublié » si nécessaire.`,
          ],
        );
        const after = adminAccountSchema.parse(result.rows[0]);
        await this.audit(client, context, 'ACCOUNT_CREATED', id, input.reason, null, after);
        return after;
      },
      true,
    );
  }
  moderate(context: AdminContext, id: string, input: Moderation) {
    return this.transaction(context, false, async (client) => {
      const found = await client.query(
        `SELECT ${courseColumns} FROM courses course LEFT JOIN accounts account ON account.id=course.owner_id WHERE course.id=$1 FOR UPDATE OF course`,
        [id],
      );
      if (!found.rows[0]) {
        throw new DomainError('NOT_FOUND', 'Ce cours est introuvable.');
      }
      const before = adminCourseSchema.parse(found.rows[0]);
      if (before.revision !== input.expectedRevision) {
        throw new DomainError('REVISION_CONFLICT', 'Ce cours a changé. Actualisez la liste.');
      }
      const moderation =
        input.action === 'RESTORE' ? 'CLEAR' : input.action === 'DELETE' ? 'DELETED' : 'WITHDRAWN';
      if (before.moderation === moderation) {
        throw new DomainError('CONFLICT', 'Ce cours est déjà dans cet état.');
      }
      const changed = await client.query<{ updatedAt: string }>(
        `UPDATE courses SET moderation=$2::varchar,status=CASE WHEN $2::varchar='CLEAR' THEN 'DRAFT' ELSE 'ARCHIVED' END,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"`,
        [id, moderation],
      );
      const after = {
        ...before,
        updatedAt: changed.rows[0].updatedAt,
        moderation,
        status: moderation === 'CLEAR' ? 'DRAFT' : 'ARCHIVED',
        revision: before.revision + 1,
      };
      await this.audit(client, context, `COURSE_${input.action}`, id, input.reason, before, after);
      return adminCourseSchema.parse(after);
    });
  }
}
