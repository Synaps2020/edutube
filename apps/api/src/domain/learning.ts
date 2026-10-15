import type { PublishedCourse, Subject } from './catalog';
export interface Enrollment {
  id: string;
  courseId: string;
  enrolledAt: string;
  completedAt: string | null;
  updatedAt: string;
  completedLessonIds: string[];
}
export interface Note {
  id: string;
  courseId: string;
  lessonId: string;
  text: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Resume {
  courseId: string;
  lessonId: string;
  visitedAt: string;
}
export interface EnrollmentTarget {
  kind: 'COURSE' | 'PATH';
  id: string;
  courseIds: string[];
}
export function courseProgress(
  course: PublishedCourse,
  enrollment: Enrollment | null,
  now: string,
) {
  const completedLessonIds = course.lessons
    .filter((lesson) => enrollment?.completedLessonIds.includes(lesson.id))
    .map((lesson) => lesson.id);
  return {
    courseId: course.id,
    curriculumRevision: course.revision,
    completedLessonIds,
    totalLessons: course.lessons.length,
    percent: Math.round((completedLessonIds.length / course.lessons.length) * 100),
    nextLessonId:
      course.lessons.find((lesson) => !completedLessonIds.includes(lesson.id))?.id ?? null,
    updatedAt: enrollment?.updatedAt ?? now,
  };
}
export function enrollmentView(course: PublishedCourse, enrollment: Enrollment) {
  const progress = courseProgress(course, enrollment, enrollment.updatedAt);
  const {
    revision: _revision,
    description: _description,
    outcomes: _outcomes,
    prerequisites: _prerequisites,
    language: _language,
    lessons: _lessons,
    ...summary
  } = course;
  return {
    course: summary,
    progress,
    enrollment: {
      id: enrollment.id,
      courseId: course.id,
      status: progress.percent === 100 ? ('COMPLETED' as const) : ('ACTIVE' as const),
      enrolledAt: enrollment.enrolledAt,
      completedAt: progress.percent === 100 ? enrollment.completedAt : null,
    },
  };
}

export interface NotebookNote extends Note {
  courseTitle: string;
  lessonTitle: string;
  subject: Subject;
}

export interface PageRequest {
  page: number;
  pageSize: number;
}
export interface LearningCounts {
  enrolledCourses: number;
  completedCourses: number;
  completedLessons: number;
  favorites: number;
  notes: number;
  attemptedQuizzes: number;
}
