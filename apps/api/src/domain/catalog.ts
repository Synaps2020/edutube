import type { Resource } from './resources';
export type SchoolLevel = 'PRIMARY' | 'MIDDLE' | 'SECONDARY';
export interface Subject {
  id: string;
  code: string;
  name: string;
}
export interface Instructor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  biography?: string;
}
export interface Cover {
  imageUrl: string | null;
  alt: string;
  illustration: 'geometry' | 'plant' | 'writing' | 'code' | null;
  palette: 'blue' | 'green' | 'orange' | 'purple';
}
export interface LessonSummary {
  id: string;
  courseId: string;
  title: string;
  order: number;
  kind: 'VIDEO' | 'READING' | 'PRACTICE';
  estimatedMinutes: number;
  previewAllowed: boolean;
  resourceCount: number;
}
export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  subject: Subject;
  schoolLevel: SchoolLevel;
  instructor: Instructor;
  durationMinutes: number;
  lessonCount: number;
  rating: { average: number | null; reviewCount: number; enrollmentCount: number };
  cover: Cover;
  featured: boolean;
  publishedAt: string;
  updatedAt: string;
}
export interface PublishedCourse extends CourseSummary {
  revision: number;
  description: string;
  outcomes: string[];
  prerequisites: string[];
  language: 'fr' | 'wo' | 'ar' | 'en';
  lessons: LessonSummary[];
}
export interface LessonContent {
  lesson: LessonSummary;
  revision: number;
  blocks: (
    { type: 'PARAGRAPH'; text: string } | { type: 'EXAMPLE'; title: string; text: string }
  )[];
  resources: Resource[];
}
export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  goal: 'EXAM' | 'DISCOVERY' | 'FOUNDATIONS';
  revision: number;
  schoolLevels: SchoolLevel[];
  courseCount: number;
  durationMinutes: number;
  cover: Cover;
  steps: { id: string; order: number; course: CourseSummary }[];
}
export interface Page<Data> {
  items: Data[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface CourseSearch {
  page: number;
  pageSize: number;
  q?: string;
  subjectId?: string;
  schoolLevel?: SchoolLevel;
  sort: 'POPULAR' | 'RATING' | 'NEWEST' | 'TITLE';
  featured?: boolean;
}
export interface PathSearch {
  page: number;
  pageSize: number;
  schoolLevel?: SchoolLevel;
  goal?: LearningPath['goal'];
}
