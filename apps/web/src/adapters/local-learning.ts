import type { LearningRepository } from '../application/ports';
import type { Enrollment } from '../domain/course';
const KEY = 'edutube.learning.v1';
export function createLocalLearning(accountId: string): LearningRepository {
  return {
    read() {
      try {
        const data: unknown = JSON.parse(localStorage.getItem(`${KEY}.${accountId}`) ?? '[]');
        if (!Array.isArray(data)) {
          return [];
        }
        return data.filter(
          (item): item is Enrollment =>
            typeof item?.courseId === 'string' &&
            Array.isArray(item.completedLessonIds) &&
            item.completedLessonIds.every((id: unknown) => typeof id === 'string'),
        );
      } catch {
        return [];
      }
    },
    save(enrollments) {
      localStorage.setItem(`${KEY}.${accountId}`, JSON.stringify(enrollments));
    },
  };
}
export const localLearning = createLocalLearning('demo');
