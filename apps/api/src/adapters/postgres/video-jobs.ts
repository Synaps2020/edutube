import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { VideoJobs, VideoJob } from '../../application/video-processing';
import type { VideoAsset } from '../../application/videos';
export class PostgresVideoJobs implements VideoJobs {
  constructor(private pool: Pool) {}
  async claim() {
    await this.pool.query(
      "UPDATE lesson_videos SET status='FAILED',error_message='La préparation a été interrompue plusieurs fois. Retirez la vidéo et joignez-la à nouveau.',updated_at=now() WHERE status='PROCESSING' AND lease_until<now() AND attempts>=3",
    );
    return (
      (
        await this.pool.query<VideoJob>(
          `UPDATE lesson_videos SET status='PROCESSING',attempts=attempts+1,processing_token=$1,lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=(SELECT id FROM lesson_videos WHERE status='QUEUED' OR (status='PROCESSING' AND lease_until<now() AND attempts<3) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,course_id AS "courseId",lesson_id AS "lessonId",file_name AS "fileName",size_bytes::float8 AS "sizeBytes",status,duration_seconds::float8 AS "durationSeconds",error_message AS "errorMessage",storage_driver AS "storageDriver",source_key AS "sourceKey",request_hash AS "requestHash",processing_token AS "processingToken"`,
          [randomUUID()],
        )
      ).rows[0] ?? null
    );
  }
  async heartbeat(job: VideoJob) {
    return !!(
      await this.pool.query(
        "UPDATE lesson_videos SET lease_until=now()+interval '2 minutes' WHERE id=$1 AND processing_token=$2 AND status='PROCESSING'",
        [job.id, job.processingToken],
      )
    ).rowCount;
  }
  async finish(job: VideoJob, duration: number, assets: VideoAsset[]) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        "UPDATE lesson_videos SET status='READY',duration_seconds=$3,error_message=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND processing_token=$2 AND status='PROCESSING' RETURNING id",
        [job.id, job.processingToken, duration],
      );
      if (result.rowCount) {
        await client.query('DELETE FROM video_assets WHERE video_id=$1', [job.id]);
        for (const asset of assets) {
          await client.query(
            'INSERT INTO video_assets(video_id,name,storage_key,media_type,size_bytes) VALUES($1,$2,$3,$4,$5)',
            [job.id, asset.name, asset.storageKey, asset.mediaType, asset.sizeBytes],
          );
        }
      }
      await client.query('COMMIT');
      return !!result.rowCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async fail(job: VideoJob) {
    await this.pool.query(
      "UPDATE lesson_videos SET status='FAILED',error_message='La vidéo n’a pas pu être préparée. Utilisez un MP4 lisible de moins de deux heures.',lease_until=NULL,updated_at=now() WHERE id=$1 AND processing_token=$2 AND status='PROCESSING'",
      [job.id, job.processingToken],
    );
  }
}
