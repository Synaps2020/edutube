import type { Pool, PoolClient } from 'pg';
import type { ResourceRepository } from '../../application/resources';
import type { ChapterAccess, Resource, StoredResource } from '../../domain/resources';
import type { ResourceUpload } from '@edutube/contracts/resources';
import { DomainError } from '../../domain/errors';
import { allowTeachingEdit } from '../../domain/teaching';
const resourceColumns = `id,course_id AS "courseId",lesson_id AS "lessonId",title,file_name AS "fileName",media_type AS "mediaType",size_bytes AS "sizeBytes"`;
const accessColumns = `course.id AS "courseId",lesson.id AS "lessonId",course.owner_id AS "ownerId",course.status,course.revision,lesson.preview_allowed AS "previewAllowed"`;
type Connection = Pool | PoolClient;
async function list(connection: Connection, courseId: string, lessonId: string) {
  const result = await connection.query<Resource>(
    `SELECT ${resourceColumns} FROM resources WHERE course_id=$1 AND lesson_id=$2 AND removed_at IS NULL ORDER BY created_at,id`,
    [courseId, lessonId],
  );
  return result.rows;
}
async function teacherChapter(
  connection: Connection,
  accountId: string,
  courseId: string,
  lessonId: string,
  locked = false,
) {
  const result = await connection.query<ChapterAccess>(
    `SELECT ${accessColumns} FROM courses course JOIN lessons lesson ON lesson.course_id=course.id WHERE course.id=$1 AND lesson.id=$2 AND course.owner_id=$3 ${locked ? 'FOR UPDATE OF course' : ''}`,
    [courseId, lessonId, accountId],
  );
  if (!result.rows[0]) {
    throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable dans votre espace.');
  }
  return result.rows[0];
}
export class PostgresResources implements ResourceRepository {
  constructor(private pool: Pool) {}
  async chapter(courseId: string, lessonId: string) {
    const result = await this.pool.query<ChapterAccess>(
      `SELECT ${accessColumns} FROM courses course JOIN lessons lesson ON lesson.course_id=course.id WHERE course.id=$1 AND lesson.id=$2`,
      [courseId, lessonId],
    );
    return result.rows[0] ?? null;
  }
  async list(courseId: string, lessonId: string, authenticated: boolean) {
    const result = await this.pool.query<Resource>(
      `SELECT resource.id,resource.course_id AS "courseId",resource.lesson_id AS "lessonId",resource.title,resource.file_name AS "fileName",resource.media_type AS "mediaType",resource.size_bytes AS "sizeBytes" FROM resources resource JOIN courses course ON course.id=resource.course_id JOIN lessons lesson ON lesson.id=resource.lesson_id WHERE resource.course_id=$1 AND resource.lesson_id=$2 AND resource.removed_at IS NULL AND course.status='PUBLISHED' AND (lesson.preview_allowed OR $3) ORDER BY resource.created_at,resource.id`,
      [courseId, lessonId, authenticated],
    );
    return result.rows;
  }
  async find(resourceId: string) {
    const result = await this.pool.query<StoredResource & { chapter: ChapterAccess }>(
      `SELECT resource.id,resource.course_id AS "courseId",resource.lesson_id AS "lessonId",resource.title,resource.file_name AS "fileName",resource.media_type AS "mediaType",resource.size_bytes AS "sizeBytes",resource.storage_key AS "storageKey",json_build_object('courseId',course.id,'lessonId',lesson.id,'ownerId',course.owner_id,'status',course.status,'revision',course.revision,'previewAllowed',lesson.preview_allowed) AS chapter FROM resources resource JOIN courses course ON course.id=resource.course_id JOIN lessons lesson ON lesson.id=resource.lesson_id WHERE resource.id=$1 AND resource.removed_at IS NULL`,
      [resourceId],
    );
    return result.rows[0] ?? null;
  }
  async teacherList(accountId: string, courseId: string, lessonId: string) {
    const chapter = await teacherChapter(this.pool, accountId, courseId, lessonId);
    return {
      courseRevision: chapter.revision,
      resources: await list(this.pool, courseId, lessonId),
    };
  }
  private async transaction<Result>(action: (client: PoolClient) => Promise<Result>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  private checkRevision(chapter: ChapterAccess, revision: number) {
    if (chapter.revision !== revision) {
      throw new DomainError(
        'REVISION_CONFLICT',
        'Le cours a changé. Rechargez-le avant de modifier ses documents.',
      );
    }
    allowTeachingEdit(chapter.status);
  }
  private async changed(
    client: PoolClient,
    accountId: string,
    courseId: string,
    lessonId: string,
    action: string,
    resourceId: string,
  ) {
    const result = await client.query<{ revision: number }>(
      'UPDATE courses SET revision=revision+1,updated_at=now() WHERE id=$1 RETURNING revision',
      [courseId],
    );
    await client.query(
      'INSERT INTO course_audit(course_id,account_id,action,revision,details) VALUES($1,$2,$3,$4,$5)',
      [courseId, accountId, action, result.rows[0].revision, JSON.stringify({ resourceId })],
    );
    return {
      courseRevision: result.rows[0].revision,
      resources: await list(client, courseId, lessonId),
    };
  }
  add(
    accountId: string,
    resource: StoredResource,
    input: ResourceUpload,
    key: string,
    fingerprint: string,
  ) {
    return this.transaction(async (client) => {
      const chapter = await teacherChapter(
        client,
        accountId,
        resource.courseId,
        resource.lessonId,
        true,
      );
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${accountId}:${key}`,
      ]);
      const replay = await client.query<{ request_hash: string; removed_at: Date | null }>(
        'SELECT request_hash,removed_at FROM resources WHERE uploaded_by=$1 AND request_key=$2',
        [accountId, key],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== fingerprint || replay.rows[0].removed_at) {
          throw new DomainError(
            'CONFLICT',
            'Cette demande a déjà été utilisée pour un autre document ou un document retiré.',
          );
        }
        return {
          inserted: false,
          view: {
            courseRevision: chapter.revision,
            resources: await list(client, resource.courseId, resource.lessonId),
          },
        };
      }
      this.checkRevision(chapter, input.expectedRevision);
      const count = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM resources WHERE course_id=$1 AND lesson_id=$2 AND removed_at IS NULL',
        [resource.courseId, resource.lessonId],
      );
      if (count.rows[0].count >= 20) {
        throw new DomainError(
          'CONFLICT',
          'Un chapitre peut contenir jusqu’à 20 documents. Retirez-en un avant de poursuivre.',
        );
      }
      await client.query(
        'INSERT INTO resources(id,course_id,lesson_id,title,file_name,media_type,size_bytes,storage_key,uploaded_by,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [
          resource.id,
          resource.courseId,
          resource.lessonId,
          resource.title,
          resource.fileName,
          resource.mediaType,
          resource.sizeBytes,
          resource.storageKey,
          accountId,
          key,
          fingerprint,
        ],
      );
      return {
        inserted: true,
        view: await this.changed(
          client,
          accountId,
          resource.courseId,
          resource.lessonId,
          'RESOURCE_ADDED',
          resource.id,
        ),
      };
    });
  }
  remove(
    accountId: string,
    courseId: string,
    lessonId: string,
    resourceId: string,
    revision: number,
  ) {
    return this.transaction(async (client) => {
      const chapter = await teacherChapter(client, accountId, courseId, lessonId, true);
      const found = await client.query<{ removed_at: Date | null }>(
        'SELECT removed_at FROM resources WHERE id=$1 AND course_id=$2 AND lesson_id=$3',
        [resourceId, courseId, lessonId],
      );
      if (!found.rows[0]) {
        throw new DomainError('NOT_FOUND', 'Ce document est introuvable dans ce chapitre.');
      }
      if (found.rows[0].removed_at) {
        return {
          courseRevision: chapter.revision,
          resources: await list(client, courseId, lessonId),
        };
      }
      this.checkRevision(chapter, revision);
      await client.query('UPDATE resources SET removed_at=now() WHERE id=$1', [resourceId]);
      return this.changed(client, accountId, courseId, lessonId, 'RESOURCE_REMOVED', resourceId);
    });
  }
}
