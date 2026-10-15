import { randomUUID, createHash } from 'node:crypto';
import type { QuizRepository } from './ports';
import { publicQuiz, gradeQuiz } from '../domain/quiz';
import { DomainError } from '../domain/errors';
import type { QuizAttemptInput } from '@edutube/contracts';
export class Exercises {
  constructor(private repository: QuizRepository) {}
  async get(courseId: string) {
    const quiz = await this.repository.findByCourse(courseId);
    if (!quiz) {
      throw new DomainError('NOT_FOUND', 'Cet exercice est introuvable.');
    }
    return publicQuiz(quiz);
  }
  async submit(accountId: string, quizId: string, input: QuizAttemptInput, key: string) {
    const quiz = await this.repository.find(quizId);
    if (!quiz) {
      throw new DomainError('NOT_FOUND', 'Cet exercice est introuvable.');
    }
    const corrections = gradeQuiz(quiz, input.quizRevision, input.answers);
    const correctCount = corrections.filter((correction) => correction.correct).length;
    const result = {
      summary: {
        id: randomUUID(),
        quizId,
        quizRevision: quiz.revision,
        courseId: quiz.courseId,
        submittedAt: new Date().toISOString(),
        correctCount,
        questionCount: quiz.questions.length,
        scorePercent: Math.round((correctCount / quiz.questions.length) * 100),
      },
      corrections,
    };
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          revision: input.quizRevision,
          answers: [...input.answers].sort((first, second) =>
            first.questionId.localeCompare(second.questionId),
          ),
        }),
      )
      .digest('hex');
    return this.repository.saveAttempt(accountId, quizId, key, fingerprint, result);
  }
}
