import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  teachingSummarySchema,
  teachingCourseSchema,
  type TeachingCourse,
  type TeachingContent,
} from '@edutube/contracts/teaching';
import type { TeachingRepository } from '../../application/teaching';
import type { Account } from '../../domain/account';
import { allowTeachingEdit, allowPublication } from '../../domain/teaching';
import { DomainError } from '../../domain/errors';
type Connection = Pool | PoolClient;
export async function loadTeachingCourse(
  connection: Connection,
  accountId: string | null,
  courseId: string,
) {
  const result = await connection.query(
    `SELECT id,title,short_description AS "shortDescription",description,subject_id AS "subjectId",school_level AS "schoolLevel",language,palette,illustration,outcomes,prerequisites,revision,status,updated_at AS "updatedAt" FROM courses WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2)`,
    [courseId, accountId],
  );
  const course = result.rows[0];
  if (!course) {
    throw new DomainError('NOT_FOUND', 'Ce cours est introuvable dans votre espace.');
  }
  const lessons = await connection.query(
    `SELECT id,title,kind,estimated_minutes AS "estimatedMinutes",preview_allowed AS "previewAllowed",requires_quiz AS "requiresQuiz",blocks FROM lessons WHERE course_id=$1 ORDER BY position`,
    [courseId],
  );
  const quizzes = await connection.query(
    'SELECT id,title,passing_score FROM quizzes WHERE course_id=$1',
    [courseId],
  );
  let quiz = null;
  if (quizzes.rows[0]) {
    const questions = await connection.query(
      `SELECT id,prompt,options,correct_option_id AS "correctOptionId",explanation FROM quiz_questions WHERE quiz_id=$1 ORDER BY position`,
      [quizzes.rows[0].id],
    );
    quiz = {
      title: quizzes.rows[0].title,
      passingScore: quizzes.rows[0].passing_score,
      questions: questions.rows,
    };
  }
  return teachingCourseSchema.parse({
    ...course,
    updatedAt: course.updatedAt.toISOString(),
    lessons: lessons.rows,
    quiz,
  });
}
export class PostgresTeaching implements TeachingRepository {
  constructor(private pool: Pool) {}
  async list(accountId: string) {
    const result = await this.pool.query(
      `SELECT id,title,revision,status,updated_at AS "updatedAt",(SELECT count(*)::int FROM lessons WHERE course_id=courses.id) AS "lessonCount" FROM courses WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 200`,
      [accountId],
    );
    return result.rows.map((course) =>
      teachingSummarySchema.parse({ ...course, updatedAt: course.updatedAt.toISOString() }),
    );
  }
  get(accountId: string, courseId: string) {
    return this.transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return loadTeachingCourse(client, accountId, courseId);
    });
  }
  private async transaction<Result>(action: (client: PoolClient) => Promise<Result>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new DomainError('CONFLICT', 'Un identifiant est déjà utilisé. Rechargez le cours.');
      }
      throw error;
    } finally {
      client.release();
    }
  }
  private async lock(client: PoolClient, accountId: string, courseId: string, revision: number) {
    const result = await client.query<{
      revision: number;
      status: TeachingCourse['status'];
      moderation: string;
    }>('SELECT revision,status,moderation FROM courses WHERE id=$1 AND owner_id=$2 FOR UPDATE', [
      courseId,
      accountId,
    ]);
    const course = result.rows[0];
    if (!course) {
      throw new DomainError('NOT_FOUND', 'Ce cours est introuvable dans votre espace.');
    }
    if (course.moderation !== 'CLEAR') {
      throw new DomainError(
        'FORBIDDEN',
        'Ce cours a été retiré par la modération. Contactez l’administration.',
      );
    }
    if (course.revision !== revision) {
      throw new DomainError(
        'REVISION_CONFLICT',
        'Le cours a changé. Rechargez-le avant de poursuivre.',
      );
    }
    return course;
  }
  private async content(client: PoolClient, courseId: string, value: TeachingContent) {
    const subject = await client.query('SELECT id FROM subjects WHERE id=$1', [value.subjectId]);
    if (!subject.rowCount) {
      throw new DomainError('CONFLICT', 'Choisissez une matière disponible.');
    }
    await client.query(
      `UPDATE courses SET title=$2,short_description=$3,description=$4,subject_id=$5,school_level=$6,language=$7,palette=$8,illustration=$9,outcomes=$10,prerequisites=$11,updated_at=now() WHERE id=$1`,
      [
        courseId,
        value.title,
        value.shortDescription,
        value.description,
        value.subjectId,
        value.schoolLevel,
        value.language,
        value.palette,
        value.illustration,
        value.outcomes,
        value.prerequisites,
      ],
    );
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM lessons WHERE course_id=$1',
      [courseId],
    );
    const retained = new Set(value.lessons.map((lesson) => lesson.id));
    if (existing.rows.some((lesson) => !retained.has(lesson.id))) {
      throw new DomainError(
        'CONFLICT',
        'Les chapitres déjà enregistrés doivent être conservés pour préserver les notes et la progression. Vous pouvez les réorganiser et les modifier.',
      );
    }
    await client.query('UPDATE lessons SET position=position+100000 WHERE course_id=$1', [
      courseId,
    ]);
    for (const [position, lesson] of value.lessons.entries()) {
      const collision = await client.query('SELECT id FROM lessons WHERE id=$1 AND course_id<>$2', [
        lesson.id,
        courseId,
      ]);
      if (collision.rowCount) {
        throw new DomainError('CONFLICT', 'Ce chapitre appartient à un autre cours.');
      }
      await client.query(
        `INSERT INTO lessons(id,course_id,title,position,kind,estimated_minutes,preview_allowed,blocks,requires_quiz) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET title=excluded.title,position=excluded.position,kind=excluded.kind,estimated_minutes=excluded.estimated_minutes,preview_allowed=excluded.preview_allowed,blocks=excluded.blocks,requires_quiz=excluded.requires_quiz,revision=lessons.revision+1`,
        [
          lesson.id,
          courseId,
          lesson.title,
          position,
          lesson.kind,
          lesson.estimatedMinutes,
          lesson.previewAllowed,
          JSON.stringify(lesson.blocks),
          lesson.requiresQuiz,
        ],
      );
    }
    const existingQuiz = await client.query<{ id: string }>(
      'SELECT id FROM quizzes WHERE course_id=$1',
      [courseId],
    );
    if (!value.quiz && existingQuiz.rowCount) {
      throw new DomainError('CONFLICT', 'Conservez le quiz existant pour préserver les résultats.');
    }
    if (value.quiz) {
      const quizId = existingQuiz.rows[0]?.id ?? randomUUID();
      await client.query(
        'INSERT INTO quizzes(id,course_id,title,passing_score) VALUES($1,$2,$3,$4) ON CONFLICT(course_id) DO UPDATE SET title=excluded.title,passing_score=excluded.passing_score,revision=quizzes.revision+1',
        [quizId, courseId, value.quiz.title, value.quiz.passingScore],
      );
      await client.query('DELETE FROM quiz_questions WHERE quiz_id=$1', [quizId]);
      for (const [position, question] of value.quiz.questions.entries()) {
        const collision = await client.query('SELECT id FROM quiz_questions WHERE id=$1', [
          question.id,
        ]);
        if (collision.rowCount) {
          throw new DomainError('CONFLICT', 'Cette question appartient à un autre cours.');
        }
        await client.query(
          'INSERT INTO quiz_questions(id,quiz_id,position,prompt,options,correct_option_id,explanation) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            question.id,
            quizId,
            position,
            question.prompt,
            JSON.stringify(question.options),
            question.correctOptionId,
            question.explanation,
          ],
        );
      }
    }
  }
  private audit(client: PoolClient, accountId: string, courseId: string, action: string) {
    return client.query(
      'INSERT INTO course_audit(course_id,account_id,action,revision) SELECT id,$2,$3,revision FROM courses WHERE id=$1',
      [courseId, accountId, action],
    );
  }
  create(account: Account, value: TeachingContent) {
    return this.transaction(async (client) => {
      const courseId = randomUUID();
      await client.query(
        'INSERT INTO instructors(id,display_name,biography) SELECT $1::varchar,$2::varchar,biography FROM accounts WHERE id=$1::uuid ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,biography=excluded.biography',
        [account.id, account.displayName],
      );
      const subject = await client.query('SELECT id FROM subjects WHERE id=$1', [value.subjectId]);
      if (!subject.rowCount) {
        throw new DomainError('CONFLICT', 'Choisissez une matière disponible.');
      }
      await client.query(
        `INSERT INTO courses(id,slug,title,short_description,description,subject_id,instructor_id,school_level,outcomes,palette,owner_id) VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          courseId,
          value.title,
          value.shortDescription,
          value.description,
          value.subjectId,
          account.id,
          value.schoolLevel,
          value.outcomes,
          value.palette,
          account.id,
        ],
      );
      await this.content(client, courseId, value);
      await this.audit(client, account.id, courseId, 'CREATED');
      return loadTeachingCourse(client, account.id, courseId);
    });
  }
  save(accountId: string, courseId: string, value: TeachingContent, revision: number) {
    return this.transaction(async (client) => {
      const course = await this.lock(client, accountId, courseId, revision);
      allowTeachingEdit(course.status);
      await this.content(client, courseId, value);
      await client.query('UPDATE courses SET revision=revision+1 WHERE id=$1', [courseId]);
      await this.audit(client, accountId, courseId, 'SAVED');
      return loadTeachingCourse(client, accountId, courseId);
    });
  }
  status(accountId: string, courseId: string, status: TeachingCourse['status'], revision: number) {
    return this.transaction(async (client) => {
      await this.lock(client, accountId, courseId, revision);
      const course = await loadTeachingCourse(client, accountId, courseId);
      if (status === 'PUBLISHED') {
        allowPublication(course);
        const missing = await client.query(
          "SELECT 1 FROM lessons lesson WHERE lesson.course_id=$1 AND lesson.kind='VIDEO' AND NOT EXISTS(SELECT 1 FROM lesson_videos video WHERE video.lesson_id=lesson.id AND video.status='READY')",
          [courseId],
        );
        if (missing.rowCount) {
          throw new DomainError(
            'CONFLICT',
            'Attendez que toutes les vidéos soient prêtes avant de publier.',
          );
        }
      }
      await client.query(
        `UPDATE courses SET status=$2::varchar,revision=revision+1,updated_at=now(),published_at=CASE WHEN $2::varchar='PUBLISHED' THEN now() ELSE published_at END WHERE id=$1`,
        [courseId, status],
      );
      await this.audit(client, accountId, courseId, status);
      return loadTeachingCourse(client, accountId, courseId);
    });
  }
}
