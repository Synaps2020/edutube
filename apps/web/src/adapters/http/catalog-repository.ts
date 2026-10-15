import type { CourseSummaryDto, CourseDetailDto, LearningPathDetailDto } from '@edutube/contracts';
import type { Course, CourseSummary, LearningPath } from '../../domain/course';
import type { CatalogRepository } from '../../application/ports';
import { api } from './runtime';
import { allPages } from './personal';
const levels = { PRIMARY: 'Primaire', MIDDLE: 'Collège', SECONDARY: 'Lycée' };
export function courseSummaryView(data: CourseSummaryDto): CourseSummary {
  return {
    id: data.id,
    title: data.title,
    description: data.shortDescription,
    subject: data.subject.name as CourseSummary['subject'],
    level: levels[data.schoolLevel],
    teacher: data.instructor.displayName,
    teacherBiography: data.instructor.biography,
    duration: `${Math.floor(data.durationMinutes / 60)} h ${String(data.durationMinutes % 60).padStart(2, '0')}`,
    rating: data.rating.average,
    learners: data.rating.enrollmentCount,
    lessonCount: data.lessonCount,
    color: data.cover.palette,
    illustration: data.cover.illustration ?? 'writing',
    featured: data.featured,
  };
}
export function courseView(data: CourseDetailDto): Course {
  return {
    ...courseSummaryView(data),
    description: data.description,
    outcomes: data.outcomes,
    lessons: data.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      kind: lesson.kind,
      minutes: lesson.estimatedMinutes,
    })),
    material: { prerequisites: data.prerequisites, summary: '', example: '', questions: [] },
  };
}
function pathView(data: LearningPathDetailDto): LearningPath {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    courseIds: data.steps.map((step) => step.course.id),
    duration: `${Math.floor(data.durationMinutes / 60)} h ${String(data.durationMinutes % 60).padStart(2, '0')}`,
  };
}
export const httpCatalog: CatalogRepository = {
  async getCourses() {
    const first = await api.catalog.list({ pageSize: 100 });
    const pages = await Promise.all(
      Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_item, index) =>
        api.catalog.list({ page: index + 2, pageSize: 100 }),
      ),
    );
    return [...first.items, ...pages.flatMap((page) => page.items)].map(courseSummaryView);
  },
  async getCourse(id) {
    return courseView(await api.catalog.get(id));
  },
  async getPaths() {
    const paths = await allPages((page) => api.paths.list({ page, pageSize: 100 }));
    return Promise.all(paths.map(async (path) => pathView(await api.paths.get(path.id))));
  },
};
