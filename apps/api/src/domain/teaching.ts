import type { TeachingContent, TeachingCourse } from '@edutube/contracts/teaching';
import type { Account } from './account';
import { DomainError } from './errors';
export function requireTeacher(account: Account) {
  if (account.role !== 'TEACHER' && account.role !== 'ADMIN') {
    throw new DomainError('FORBIDDEN', 'Cet espace est réservé aux enseignants.');
  }
}
export function validateTeaching(value: TeachingContent) {
  if (
    value.lessons.some((lesson) => lesson.requiresQuiz && (lesson.previewAllowed || !value.quiz))
  ) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Un chapitre protégé exige un quiz et ne peut pas être proposé en aperçu public.',
    );
  }
  if (
    new Set(value.lessons.map((lesson) => lesson.id)).size !== value.lessons.length ||
    (value.quiz &&
      new Set(value.quiz.questions.map((question) => question.id)).size !==
        value.quiz.questions.length)
  ) {
    throw new DomainError('CONFLICT', 'Chaque chapitre et chaque question doit être distinct.');
  }
}
export function allowTeachingEdit(status: TeachingCourse['status']) {
  if (status !== 'DRAFT') {
    throw new DomainError('CONFLICT', 'Retirez le cours du catalogue avant de le modifier.');
  }
}
export function allowPublication(course: TeachingCourse) {
  if (!course.lessons.length) {
    throw new DomainError('CONFLICT', 'Ajoutez au moins un chapitre avant de publier.');
  }
}
