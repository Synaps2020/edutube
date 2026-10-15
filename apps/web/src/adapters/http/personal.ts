import type { ApiPage, EnrollmentViewDto, CourseProgressDto } from '@edutube/contracts';
import type { LearningAccess } from '../../application/ports';
import { api } from './runtime';
export async function allPages<Data>(
  read: (page: number) => Promise<ApiPage<Data>>,
): Promise<Data[]> {
  const items: Data[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await read(page);
    items.push(...result.items);
    totalPages = result.pagination.totalPages;
    page++;
  } while (page <= totalPages);
  return items;
}
export const httpLearning: LearningAccess = {
  list: (signal) => allPages((page) => api.enrollments.list({ page, pageSize: 100 }, { signal })),
  enroll: (courseId) => api.enrollments.enroll(courseId, { idempotencyKey: crypto.randomUUID() }),
  enrollPath: async (pathId) =>
    (await api.enrollments.enrollPath(pathId, { idempotencyKey: crypto.randomUUID() })).enrollments,
  complete: (courseId, lessonId, completed) =>
    api.progress.setCompleted(courseId, lessonId, completed),
};
export function enrollmentView(data: EnrollmentViewDto) {
  return progressView(data.progress);
}
export function progressView(data: CourseProgressDto) {
  return {
    courseId: data.courseId,
    completedLessonIds: data.completedLessonIds,
    percent: data.percent,
    nextLessonId: data.nextLessonId,
  };
}
