import type { VideoView, VideoState, LessonAccess } from '@edutube/contracts/videos';
export interface VideoAccess {
  playback(courseId: string, lessonId: string, signal?: AbortSignal): Promise<VideoView | null>;
  access(courseId: string, signal?: AbortSignal): Promise<LessonAccess>;
  teacher(courseId: string, lessonId: string, signal?: AbortSignal): Promise<VideoState>;
  upload(
    courseId: string,
    lessonId: string,
    revision: number,
    file: File,
    key: string,
    signal?: AbortSignal,
  ): Promise<VideoState>;
  remove(courseId: string, lessonId: string, revision: number): Promise<VideoState>;
}
