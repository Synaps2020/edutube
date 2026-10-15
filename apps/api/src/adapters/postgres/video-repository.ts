import type { Pool, PoolClient } from 'pg';
import { videoSchema } from '@edutube/contracts/videos';
import type { VideoRepository, VideoRecord, VideoAsset } from '../../application/videos';
import { videoView } from '../../application/videos';
import { DomainError } from '../../domain/errors';
const columns = `id,course_id AS "courseId",lesson_id AS "lessonId",file_name AS "fileName",size_bytes::float8 AS "sizeBytes",status,duration_seconds::float8 AS "durationSeconds",error_message AS "errorMessage",storage_driver AS "storageDriver",source_key AS "sourceKey",request_hash AS "requestHash"`;
export class PostgresVideos implements VideoRepository {
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
  private async lock(
    client: PoolClient,
    accountId: string,
    courseId: string,
    lessonId: string,
    revision: number,
  ) {
    const result = await client.query<{ revision: number; status: string }>(
      'SELECT course.revision,course.status FROM courses course JOIN lessons lesson ON lesson.course_id=course.id WHERE course.id=$1 AND lesson.id=$2 AND course.owner_id=$3 FOR UPDATE OF course',
      [courseId, lessonId, accountId],
    );
    const course = result.rows[0];
    if (!course) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable dans votre espace.');
    }
    if (course.revision !== revision) {
      throw new DomainError('REVISION_CONFLICT', 'Le cours a changé. Rechargez-le.');
    }
    if (course.status !== 'DRAFT') {
      throw new DomainError(
        'CONFLICT',
        'Remettez le cours en brouillon avant de modifier ses vidéos.',
      );
    }
  }
  private async changed(
    client: PoolClient,
    accountId: string,
    courseId: string,
    videoId: string,
    action: string,
  ) {
    const result = await client.query<{ revision: number }>(
      'UPDATE courses SET revision=revision+1,updated_at=now() WHERE id=$1 RETURNING revision',
      [courseId],
    );
    await client.query(
      'INSERT INTO course_audit(course_id,account_id,action,revision,details) VALUES($1,$2,$3,$4,$5)',
      [courseId, accountId, action, result.rows[0].revision, { videoId }],
    );
    return result.rows[0].revision;
  }
  async teacher(courseId: string, lessonId: string, accountId: string) {
    const course = await this.pool.query<{ revision: number }>(
      'SELECT revision FROM courses WHERE id=$1 AND owner_id=$2 AND EXISTS(SELECT 1 FROM lessons WHERE course_id=$1 AND id=$3)',
      [courseId, accountId, lessonId],
    );
    if (!course.rows[0]) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable dans votre espace.');
    }
    return { revision: course.rows[0].revision, video: await this.find(courseId, lessonId) };
  }
  async find(courseId: string, lessonId: string) {
    return (
      (
        await this.pool.query<VideoRecord>(
          `SELECT ${columns} FROM lesson_videos WHERE course_id=$1 AND lesson_id=$2 AND status<>'REMOVED'`,
          [courseId, lessonId],
        )
      ).rows[0] ?? null
    );
  }
  async replay(accountId: string, key: string) {
    return (
      (
        await this.pool.query<VideoRecord>(
          `SELECT ${columns} FROM lesson_videos WHERE uploaded_by=$1 AND request_key=$2`,
          [accountId, key],
        )
      ).rows[0] ?? null
    );
  }
  async add(
    accountId: string,
    courseId: string,
    lessonId: string,
    revision: number,
    record: VideoRecord,
    key: string,
  ) {
    return this.transaction(async (client) => {
      await this.lock(client, accountId, courseId, lessonId, revision);
      if (
        (
          await client.query(
            "SELECT 1 FROM lesson_videos WHERE lesson_id=$1 AND status<>'REMOVED'",
            [lessonId],
          )
        ).rowCount
      ) {
        throw new DomainError(
          'CONFLICT',
          'Retirez la vidéo actuelle avant d’en joindre une autre.',
        );
      }
      videoSchema.parse(videoView(record));
      await client.query(
        `INSERT INTO lesson_videos(id,course_id,lesson_id,uploaded_by,storage_driver,source_key,file_name,size_bytes,status,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'QUEUED',$9,$10)`,
        [
          record.id,
          courseId,
          lessonId,
          accountId,
          record.storageDriver,
          record.sourceKey,
          record.fileName,
          record.sizeBytes,
          key,
          record.requestHash,
        ],
      );
      await client.query("UPDATE lessons SET kind='VIDEO',revision=revision+1 WHERE id=$1", [
        lessonId,
      ]);
      return {
        revision: await this.changed(client, accountId, courseId, record.id, 'VIDEO_ADDED'),
        video: record,
      };
    });
  }
  async remove(accountId: string, courseId: string, lessonId: string, revision: number) {
    return this.transaction(async (client) => {
      await this.lock(client, accountId, courseId, lessonId, revision);
      const result = await client.query<{ id: string }>(
        "UPDATE lesson_videos SET status='REMOVED',updated_at=now() WHERE course_id=$1 AND lesson_id=$2 AND status<>'REMOVED' RETURNING id",
        [courseId, lessonId],
      );
      if (!result.rows[0]) {
        throw new DomainError('NOT_FOUND', 'Aucune vidéo n’est jointe à ce chapitre.');
      }
      await client.query("UPDATE lessons SET kind='READING',revision=revision+1 WHERE id=$1", [
        lessonId,
      ]);
      return this.changed(client, accountId, courseId, result.rows[0].id, 'VIDEO_REMOVED');
    });
  }
  async asset(videoId: string, name: string) {
    return (
      (
        await this.pool.query<VideoAsset>(
          'SELECT name,storage_key AS "storageKey",media_type AS "mediaType",size_bytes AS "sizeBytes" FROM video_assets WHERE video_id=$1 AND name=$2',
          [videoId, name],
        )
      ).rows[0] ?? null
    );
  }
}
