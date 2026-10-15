import type { Course, Enrollment } from '../domain/course';
export function enroll(enrollments: Enrollment[], courseId: string): Enrollment[] {
  return enrollments.some((enrollment) => enrollment.courseId === courseId)
    ? enrollments
    : [...enrollments, { courseId, completedLessonIds: [] }];
}
export function completeLesson(
  enrollments: Enrollment[],
  course: Course,
  lessonId: string,
): Enrollment[] {
  if (!course.lessons.some((lesson) => lesson.id === lessonId)) {
    return enrollments;
  }
  return enroll(enrollments, course.id).map((enrollment) =>
    enrollment.courseId === course.id
      ? {
          ...enrollment,
          completedLessonIds: [...new Set([...enrollment.completedLessonIds, lessonId])],
        }
      : enrollment,
  );
}
