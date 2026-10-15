import type { VideoAccess } from '../../application/videos';
import { videoSchema, videoStateSchema, lessonAccessSchema } from '@edutube/contracts/videos';
import { httpClient } from './runtime';
const target = (courseId: string, lessonId: string) =>
  `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/video`;
export const videoService: VideoAccess = {
  playback: (courseId: string, lessonId: string, signal?: AbortSignal) =>
    httpClient.request(target(courseId, lessonId), videoSchema.nullable(), { signal }),
  access: (courseId: string, signal?: AbortSignal) =>
    httpClient.request(`/courses/${encodeURIComponent(courseId)}/access`, lessonAccessSchema, {
      signal,
    }),
  teacher: (courseId: string, lessonId: string, signal?: AbortSignal) =>
    httpClient.request('/teaching' + target(courseId, lessonId), videoStateSchema, { signal }),
  upload: (
    courseId: string,
    lessonId: string,
    revision: number,
    file: File,
    key: string,
    signal?: AbortSignal,
  ) => {
    const form = new FormData();
    form.set('expectedRevision', String(revision));
    form.set('file', file);
    return httpClient.request('/teaching' + target(courseId, lessonId), videoStateSchema, {
      method: 'POST',
      formData: form,
      idempotencyKey: key,
      signal,
      timeoutMs: 900000,
    });
  },
  remove: (courseId: string, lessonId: string, revision: number) =>
    httpClient.request('/teaching' + target(courseId, lessonId), videoStateSchema, {
      method: 'DELETE',
      body: { expectedRevision: revision },
    }),
};
