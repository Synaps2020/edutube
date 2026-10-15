import type { StudyRepository } from '../application/ports';
import { emptyStudy, type StudyState } from '../domain/study';
const KEY = 'edutube.study.v1';
export function createLocalStudy(accountId: string): StudyRepository {
  return {
    read() {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(`${KEY}.${accountId}`) ?? 'null');
        if (!value || typeof value !== 'object') {
          return emptyStudy;
        }
        const study = value as Partial<StudyState>;
        const entries = (data: unknown) =>
          data && typeof data === 'object' && !Array.isArray(data) ? Object.entries(data) : [];
        return {
          favorites: Array.isArray(study.favorites)
            ? study.favorites.filter((id): id is string => typeof id === 'string')
            : [],
          notes: Object.fromEntries(
            entries(study.notes).filter(([, text]) => typeof text === 'string'),
          ),
          quizScores: Object.fromEntries(
            entries(study.quizScores).filter(
              ([, score]) =>
                typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100,
            ),
          ),
          lastLesson:
            study.lastLesson &&
            typeof study.lastLesson.courseId === 'string' &&
            typeof study.lastLesson.lessonId === 'string'
              ? study.lastLesson
              : null,
        };
      } catch {
        return emptyStudy;
      }
    },
    save(state) {
      localStorage.setItem(`${KEY}.${accountId}`, JSON.stringify(state));
    },
  };
}
export const localStudy = createLocalStudy('demo');
