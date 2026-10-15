import { teachingCourseSchema } from '@edutube/contracts/teaching';
import { videoSchema } from '@edutube/contracts/videos';
import {
  adminOverviewSchema,
  adminAccountsSchema,
  adminCoursesSchema,
  adminJournalSchema,
  adminAccountSchema,
  adminCourseSchema,
  type AccountCreate,
  type AccountChange,
  type Moderation,
} from '@edutube/contracts/administration';
import { httpClient } from './runtime';
export const administration = {
  overview: () => httpClient.request('/administration/overview', adminOverviewSchema),
  review: (id: string) =>
    httpClient.request(`/administration/courses/${encodeURIComponent(id)}`, teachingCourseSchema),
  video: (courseId: string, lessonId: string) =>
    httpClient.request(
      `/administration/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/video`,
      videoSchema.nullable(),
    ),
  accounts: (query: string, page: number, filter = 'all') =>
    httpClient.request(
      `/administration/accounts?${new URLSearchParams({ query, page: String(page), filter })}`,
      adminAccountsSchema,
    ),
  courses: (query: string, page: number, filter = 'all') =>
    httpClient.request(
      `/administration/courses?${new URLSearchParams({ query, page: String(page), filter })}`,
      adminCoursesSchema,
    ),
  journal: (query: string, page: number, filter = 'all') =>
    httpClient.request(
      `/administration/journal?${new URLSearchParams({ query, page: String(page), filter })}`,
      adminJournalSchema,
    ),
  create: (body: AccountCreate) =>
    httpClient.request('/administration/accounts', adminAccountSchema, { method: 'POST', body }),
  change: (id: string, body: AccountChange) =>
    httpClient.request(`/administration/accounts/${encodeURIComponent(id)}`, adminAccountSchema, {
      method: 'PUT',
      body,
    }),
  moderate: (id: string, body: Moderation) =>
    httpClient.request(`/administration/courses/${encodeURIComponent(id)}`, adminCourseSchema, {
      method: 'PUT',
      body,
    }),
};
