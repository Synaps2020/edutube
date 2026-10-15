import { z } from 'zod';
import {
  teachingSummarySchema,
  teachingContentSchema,
  teachingCourseSchema,
  teachingSaveSchema,
  teachingStatusSchema,
  type TeachingContent,
  type TeachingCourse,
} from '@edutube/contracts/teaching';
import { httpClient } from './runtime';
function checkedInput<Input>(schema: z.ZodType<Input>, value: unknown): Input {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      'Vérifiez les champs du cours : titres et textes sont obligatoires, chaque quiz doit contenir une question et une réponse correcte.',
    );
  }
  return result.data;
}
const address = (id: string) => `/teaching/courses/${encodeURIComponent(id)}`;
export const teachingService = {
  list: () => httpClient.request('/teaching/courses', z.array(teachingSummarySchema)),
  get: (id: string) => httpClient.request(address(id), teachingCourseSchema),
  create: (content: TeachingContent) =>
    httpClient.request('/teaching/courses', teachingCourseSchema, {
      method: 'POST',
      body: checkedInput(teachingContentSchema, content),
    }),
  save: (course: TeachingCourse) => {
    const { id, revision, status: _status, updatedAt: _updatedAt, ...content } = course;
    return httpClient.request(address(id), teachingCourseSchema, {
      method: 'PUT',
      body: checkedInput(teachingSaveSchema, { ...content, expectedRevision: revision }),
    });
  },
  status: (course: TeachingCourse, status: TeachingCourse['status']) =>
    httpClient.request(`${address(course.id)}/status`, teachingCourseSchema, {
      method: 'PUT',
      body: teachingStatusSchema.parse({ status, expectedRevision: course.revision }),
    }),
};
