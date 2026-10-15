import type { CourseSummary } from '../domain/course';
export interface CatalogFilter {
  query: string;
  subject: string;
  level: string;
  sort: string;
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function filterCourses(courses: CourseSummary[], filter: CatalogFilter): CourseSummary[] {
  const result = courses.filter(
    (course) =>
      (!filter.subject || course.subject === filter.subject) &&
      (!filter.level || course.level === filter.level) &&
      normalize(
        `${course.title} ${course.description} ${course.teacher} ${course.subject}`,
      ).includes(normalize(filter.query)),
  );
  return [...result].sort((first, second) =>
    filter.sort === 'rating'
      ? (second.rating ?? 0) - (first.rating ?? 0)
      : second.learners - first.learners,
  );
}
