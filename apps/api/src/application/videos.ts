import { requireAdministrator } from './administration';
import { videoRange } from '../domain/video-range';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Account } from '../domain/account';
import { requireTeacher } from '../domain/teaching';
import { DomainError } from '../domain/errors';
import type { ChapterAccess } from './chapter-access';
import type { VideoStorages } from './video-storage';
import type { VideoView } from '@edutube/contracts/videos';
import type { VideoRecord, VideoAsset } from '../domain/video';
export type { VideoRecord, VideoAsset } from '../domain/video';
export interface VideoRepository {
  teacher(
    courseId: string,
    lessonId: string,
    accountId: string,
  ): Promise<{ revision: number; video: VideoRecord | null }>;
  find(courseId: string, lessonId: string): Promise<VideoRecord | null>;
  add(
    accountId: string,
    courseId: string,
    lessonId: string,
    revision: number,
    record: VideoRecord,
    key: string,
  ): Promise<{ revision: number; video: VideoRecord }>;
  remove(accountId: string, courseId: string, lessonId: string, revision: number): Promise<number>;
  replay(accountId: string, key: string): Promise<VideoRecord | null>;
  asset(videoId: string, name: string): Promise<VideoAsset | null>;
}
export function videoView(video: VideoRecord): VideoView {
  return {
    id: video.id,
    courseId: video.courseId,
    lessonId: video.lessonId,
    fileName: video.fileName,
    sizeBytes: video.sizeBytes,
    status: video.status,
    durationSeconds: video.durationSeconds,
    errorMessage: video.errorMessage,
    playbackUrl:
      video.status === 'READY'
        ? `/api/v1/courses/${video.courseId}/lessons/${video.lessonId}/video/files/master.m3u8`
        : null,
    posterUrl:
      video.status === 'READY'
        ? `/api/v1/courses/${video.courseId}/lessons/${video.lessonId}/video/files/poster.jpg`
        : null,
  };
}
export class Videos {
  constructor(
    private repository: VideoRepository,
    private storage: VideoStorages,
    private access: ChapterAccess,
  ) {}
  async teacher(account: Account, courseId: string, lessonId: string) {
    requireTeacher(account);
    const result = await this.repository.teacher(courseId, lessonId, account.id);
    return {
      courseRevision: result.revision,
      video: result.video ? videoView(result.video) : null,
    };
  }
  async upload(
    account: Account,
    courseId: string,
    lessonId: string,
    revision: number,
    key: string,
    file: { path: string; fileName: string; size: number; hash: string },
  ) {
    requireTeacher(account);
    const previous = await this.repository.replay(account.id, key);
    if (previous) {
      if (previous.status === 'REMOVED') {
        throw new DomainError(
          'CONFLICT',
          'Cette vidéo a été retirée. Recommencez avec une nouvelle demande.',
        );
      }
      if (
        previous.requestHash !== file.hash ||
        previous.courseId !== courseId ||
        previous.lessonId !== lessonId ||
        previous.fileName !== file.fileName
      ) {
        throw new DomainError('CONFLICT', 'Cette demande a déjà servi pour une autre vidéo.');
      }
      return this.teacher(account, courseId, lessonId);
    }
    const current = await this.repository.teacher(courseId, lessonId, account.id);
    if (current.revision !== revision) {
      throw new DomainError(
        'REVISION_CONFLICT',
        'Le cours a changé. Rechargez-le avant de joindre la vidéo.',
      );
    }
    const id = randomUUID();
    const store = this.storage.get();
    const record: VideoRecord = {
      id,
      courseId,
      lessonId,
      fileName: file.fileName,
      sizeBytes: file.size,
      status: 'QUEUED',
      durationSeconds: null,
      errorMessage: null,
      storageDriver: store.driver,
      sourceKey: `videos/${id}/source.mp4`,
      requestHash: file.hash,
    };
    await store.write(record.sourceKey, createReadStream(file.path), file.size, 'video/mp4');
    try {
      const result = await this.repository.add(
        account.id,
        courseId,
        lessonId,
        revision,
        record,
        key,
      );
      return { courseRevision: result.revision, video: videoView(result.video) };
    } catch (error) {
      await store.remove(record.sourceKey).catch(() => undefined);
      throw error;
    }
  }
  async remove(account: Account, courseId: string, lessonId: string, revision: number) {
    requireTeacher(account);
    return {
      courseRevision: await this.repository.remove(account.id, courseId, lessonId, revision),
      video: null,
    };
  }
  async reviewPlayback(courseId: string, lessonId: string, account: Account) {
    requireAdministrator(account);
    const video = await this.repository.find(courseId, lessonId);
    if (!video) {
      return null;
    }
    const view = videoView(video);
    return {
      ...view,
      playbackUrl:
        view.playbackUrl?.replace('/api/v1/courses/', '/api/v1/administration/courses/') ?? null,
      posterUrl:
        view.posterUrl?.replace('/api/v1/courses/', '/api/v1/administration/courses/') ?? null,
    };
  }
  async reviewFile(
    courseId: string,
    lessonId: string,
    name: string,
    account: Account,
    rangeHeader?: string,
  ) {
    requireAdministrator(account);
    return this.streamFile(courseId, lessonId, name, rangeHeader);
  }
  async playback(courseId: string, lessonId: string, account: Account | null) {
    await this.access.assert(courseId, lessonId, account, true);
    const video = await this.repository.find(courseId, lessonId);
    return video ? videoView(video) : null;
  }
  async file(
    courseId: string,
    lessonId: string,
    name: string,
    account: Account | null,
    rangeHeader?: string,
  ) {
    await this.access.assert(courseId, lessonId, account, true);
    return this.streamFile(courseId, lessonId, name, rangeHeader);
  }
  private async streamFile(courseId: string, lessonId: string, name: string, rangeHeader?: string) {
    const video = await this.repository.find(courseId, lessonId);
    const asset = video?.status === 'READY' ? await this.repository.asset(video.id, name) : null;
    if (!video || !asset) {
      throw new DomainError('NOT_FOUND', 'Cette vidéo n’est pas encore disponible.');
    }
    let range: ReturnType<typeof videoRange>;
    try {
      range = videoRange(rangeHeader, asset.sizeBytes);
    } catch {
      return { asset, stream: null, range: null, invalidRange: true };
    }
    return {
      asset,
      range,
      invalidRange: false,
      stream: await this.storage
        .get(video.storageDriver)
        .read(asset.storageKey, range ?? undefined),
    };
  }
}
