import type { Pool } from 'pg';
import { quizAttemptSchema, type QuizAttemptDto } from '@edutube/contracts';
import type { QuizRepository } from '../../application/ports';
import type { Quiz, QuizQuestion } from '../../domain/quiz';
import { DomainError } from '../../domain/errors';
export class PostgresQuizzes implements QuizRepository {
  constructor(private pool: Pool) {}
  async findByCourse(courseId: string) {
    return this.load('quiz.course_id', courseId);
  }
  async find(id: string) {
    return this.load('quiz.id', id);
  }
  private async load(column: 'quiz.id' | 'quiz.course_id', id: string): Promise<Quiz | null> {
    const result = await this.pool.query<{
      id: string;
      course_id: string;
      title: string;
      revision: number;
    }>(
      `SELECT quiz.* FROM quizzes quiz JOIN courses course ON course.id=quiz.course_id WHERE ${column}=$1 AND course.status='PUBLISHED'`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const questions = await this.pool.query<{
      id: string;
      prompt: string;
      options: QuizQuestion['options'];
      correct_option_id: string;
      explanation: string;
    }>('SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY position', [row.id]);
    if (!questions.rowCount) {
      return null;
    }
    return {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      revision: row.revision,
      questions: questions.rows.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        correctOptionId: question.correct_option_id,
        explanation: question.explanation,
      })),
    };
  }
  async saveAttempt(
    accountId: string,
    quizId: string,
    key: string,
    fingerprint: string,
    result: QuizAttemptDto,
  ) {
    const inserted = await this.pool.query<{ result: unknown }>(
      'INSERT INTO quiz_attempts(id,account_id,quiz_id,request_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(account_id,quiz_id,request_key) DO NOTHING RETURNING result',
      [result.summary.id, accountId, quizId, key, fingerprint, result],
    );
    if (inserted.rows[0]) {
      return quizAttemptSchema.parse(inserted.rows[0].result);
    }
    const previous = await this.pool.query<{ result: unknown; request_hash: string }>(
      'SELECT result,request_hash FROM quiz_attempts WHERE account_id=$1 AND quiz_id=$2 AND request_key=$3',
      [accountId, quizId, key],
    );
    if (previous.rows[0]?.request_hash !== fingerprint) {
      throw new DomainError(
        'CONFLICT',
        'Cette demande a déjà été utilisée pour d’autres réponses.',
      );
    }
    return quizAttemptSchema.parse(previous.rows[0].result);
  }
}
