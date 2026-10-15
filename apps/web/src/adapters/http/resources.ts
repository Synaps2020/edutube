import {
  teachingResourcesSchema,
  resourceUploadSchema,
  resourceRemoveSchema,
  resourceLimit,
  type ResourceUpload,
} from '@edutube/contracts/resources';
import { idSchema } from '@edutube/contracts';
import { httpClient } from './runtime';
const address = (courseId: string, lessonId: string) =>
  `/teaching/courses/${encodeURIComponent(idSchema.parse(courseId))}/lessons/${encodeURIComponent(idSchema.parse(lessonId))}/resources`;
export const resourceService = {
  list(courseId: string, lessonId: string, signal?: AbortSignal) {
    return httpClient.request(address(courseId, lessonId), teachingResourcesSchema, { signal });
  },
  upload(
    courseId: string,
    lessonId: string,
    input: ResourceUpload,
    file: File,
    requestKey: string,
  ) {
    const checked = resourceUploadSchema.safeParse(input);
    if (!checked.success) {
      throw new Error('Donnez un titre au document, avec 200 caractères maximum.');
    }
    if (!file.size || file.size > resourceLimit || !/\.(pdf|txt)$/i.test(file.name)) {
      throw new Error('Choisissez un PDF ou un TXT non vide, de 10 Mo maximum.');
    }
    const formData = new FormData();
    formData.append('title', checked.data.title);
    formData.append('expectedRevision', String(checked.data.expectedRevision));
    formData.append('file', file);
    return httpClient.request(address(courseId, lessonId), teachingResourcesSchema, {
      method: 'POST',
      formData,
      idempotencyKey: requestKey,
      timeoutMs: 60000,
    });
  },
  remove(courseId: string, lessonId: string, resourceId: string, expectedRevision: number) {
    return httpClient.request(
      `${address(courseId, lessonId)}/${encodeURIComponent(idSchema.parse(resourceId))}`,
      teachingResourcesSchema,
      { method: 'DELETE', body: resourceRemoveSchema.parse({ expectedRevision }) },
    );
  },
};
