import type { CourseMaterial } from './study';
export type Subject = string;
export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  kind?: 'VIDEO' | 'READING' | 'PRACTICE';
}
export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  subject: Subject;
  level: string;
  teacher: string;
  teacherBiography?: string;
  duration: string;
  rating: number | null;
  lessonCount: number;
  learners: number;
  color: string;
  illustration: 'geometry' | 'plant' | 'writing' | 'code';
  featured?: boolean;
}
export interface Course extends CourseSummary {
  material: CourseMaterial;
  outcomes: string[];
  lessons: Lesson[];
}
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  duration: string;
}
export interface Enrollment {
  courseId: string;
  completedLessonIds: string[];
  percent?: number;
  nextLessonId?: string | null;
}
export function progress(course: CourseSummary, enrollment?: Enrollment): number {
  if (enrollment?.percent !== undefined) {
    return enrollment.percent;
  }
  if (!enrollment || !hasLessonList(course) || !course.lessons.length) {
    return 0;
  }
  const completed = course.lessons.filter((lesson) =>
    enrollment.completedLessonIds.includes(lesson.id),
  ).length;
  return Math.round((completed / course.lessons.length) * 100);
}

function hasLessonList(course: CourseSummary): course is CourseSummary & { lessons: Lesson[] } {
  return 'lessons' in course && Array.isArray(course.lessons);
}
