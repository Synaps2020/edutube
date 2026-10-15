import type { Account } from '../domain/account';
import { DomainError } from '../domain/errors';
export interface ChapterAccessRecord {
  courseId: string;
  ownerId: string | null;
  status: string;
  enrolled: boolean;
  passed: boolean;
  passingScore: number;
  lessons: { id: string; position: number; previewAllowed: boolean; requiresQuiz: boolean }[];
}
export interface ChapterAccessRepository {
  read(courseId: string, accountId: string | null): Promise<ChapterAccessRecord | null>;
  courseForLesson(lessonId: string): Promise<string | null>;
  chapterForResource(resourceId: string): Promise<{ courseId: string; lessonId: string } | null>;
}
export class ChapterAccess {
  constructor(private repository: ChapterAccessRepository) {}
  private view(record: ChapterAccessRecord | null, account: Account | null) {
    const owner =
      !!account && record?.ownerId === account.id && ['TEACHER', 'ADMIN'].includes(account.role);
    if (!record || (record.status !== 'PUBLISHED' && !owner)) {
      throw new DomainError('NOT_FOUND', 'Ce cours est introuvable.');
    }
    return {
      courseId: record.courseId,
      passed: record.passed,
      passingScore: record.passingScore,
      lessons: record.lessons.map((lesson) => ({
        id: lesson.id,
        requiresQuiz: lesson.requiresQuiz,
        locked:
          !owner &&
          !record.passed &&
          record.lessons.some((gate) => gate.requiresQuiz && gate.position <= lesson.position),
      })),
    };
  }
  async state(courseId: string, account: Account | null) {
    return this.view(await this.repository.read(courseId, account?.id ?? null), account);
  }
  async assert(
    courseId: string,
    lessonId: string,
    account: Account | null,
    requireEnrollment = false,
  ) {
    const record = await this.repository.read(courseId, account?.id ?? null);
    const state = this.view(record, account);
    const chapter = state.lessons.find((lesson) => lesson.id === lessonId);
    if (!chapter) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable.');
    }
    if (chapter.locked) {
      throw new DomainError(
        'FORBIDDEN',
        `Réussissez l’examen du cours avec au moins ${state.passingScore}% pour débloquer ce chapitre.`,
      );
    }
    const lesson = record!.lessons.find((item) => item.id === lessonId)!;
    const owner = account?.id === record!.ownerId && ['TEACHER', 'ADMIN'].includes(account.role);
    if (!lesson.previewAllowed && !owner && !account) {
      throw new DomainError('UNAUTHENTICATED', 'Connectez-vous pour regarder ce chapitre.');
    }
    if (requireEnrollment && !lesson.previewAllowed && !owner && !record!.enrolled) {
      throw new DomainError('FORBIDDEN', 'Inscrivez-vous au cours pour regarder ses vidéos.');
    }
  }
  async assertLesson(lessonId: string, account: Account | null) {
    const courseId = await this.repository.courseForLesson(lessonId);
    if (courseId) {
      await this.assert(courseId, lessonId, account);
    }
  }
  async assertResource(resourceId: string, account: Account | null) {
    const chapter = await this.repository.chapterForResource(resourceId);
    if (chapter) {
      await this.assert(chapter.courseId, chapter.lessonId, account);
    }
  }
}
