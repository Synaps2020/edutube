import { describe, expect, it } from 'vitest';
import { enroll, completeLesson } from './learning';
import { filterCourses } from './catalog';
import { progress } from '../domain/course';
import { demoCourses } from '../adapters/demo-catalog';
describe('apprentissage', () => {
  it('une inscription reste unique', () =>
    expect(enroll(enroll([], 'thales'), 'thales')).toHaveLength(1));
  it('ignore un chapitre étranger au cours', () =>
    expect(completeLesson([], demoCourses[0], 'unknown')).toEqual([]));
  it('ne compte une leçon qu’une fois et calcule la progression', () => {
    const course = demoCourses[0];
    const first = completeLesson([], course, course.lessons[0].id);
    const second = completeLesson(first, course, course.lessons[0].id);
    expect(second[0].completedLessonIds).toHaveLength(1);
    expect(progress(course, second[0])).toBe(25);
  });
  it('ne compte pas des identifiants de chapitres supprimés', () =>
    expect(progress(demoCourses[0], { courseId: 'thales', completedLessonIds: ['old'] })).toBe(0));
});
describe('catalogue', () => {
  it('recherche sans accents et combine les filtres', () => {
    const found = filterCourses(demoCourses, {
      query: 'geometrie',
      subject: 'Mathématiques',
      level: 'Collège',
      sort: 'rating',
    });
    expect(found.map((course) => course.id)).toEqual(['thales']);
  });
  it('ne modifie pas l’ordre du catalogue source', () => {
    const ids = demoCourses.map((course) => course.id);
    filterCourses(demoCourses, { query: '', subject: '', level: '', sort: 'popular' });
    expect(demoCourses.map((course) => course.id)).toEqual(ids);
  });
});
