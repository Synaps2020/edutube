import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { LearningRepository } from '../../application/ports';
import type {
  Enrollment,
  EnrollmentTarget,
  Note,
  NotebookNote,
  PageRequest,
  LearningCounts,
  Resume,
} from '../../domain/learning';
import { DomainError } from '../../domain/errors';
import type { CourseSearch } from '../../domain/catalog';
import { quizAttemptSummarySchema } from '@edutube/contracts';
interface EnrollmentRow {
  id: string;
  course_id: string;
  enrolled_at: Date;
  completed_at: Date | null;
  updated_at: Date;
  completed_ids: string[];
}
interface NoteRow {
  id: string;
  course_id: string;
  lesson_id: string;
  text: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}
const enrollmentSelect = `SELECT enrollment.*, ARRAY(SELECT completion.lesson_id FROM lesson_completions completion JOIN lessons lesson ON lesson.id=completion.lesson_id WHERE completion.account_id=enrollment.account_id AND completion.course_id=enrollment.course_id ORDER BY lesson.position) AS completed_ids FROM enrollments enrollment`;
function enrollment(row: EnrollmentRow): Enrollment {
  return {
    id: row.id,
    courseId: row.course_id,
    enrolledAt: row.enrolled_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    completedLessonIds: row.completed_ids,
  };
}
function note(row: NoteRow): Note {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    text: row.text,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export class PostgresLearning implements LearningRepository {
  constructor(private pool: Pool) {}
  private async transaction<Data>(operation: (client: PoolClient) => Promise<Data>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  private async readPage<Row extends QueryResultRow, Data>(
    query: string,
    countQuery: string,
    values: unknown[],
    pagination: PageRequest,
    convert: (row: Row) => Data,
  ) {
    const [count, result] = await Promise.all([
      this.pool.query<{ total: number }>(countQuery, values),
      this.pool.query<Row>(`${query} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [
        ...values,
        pagination.pageSize,
        (pagination.page - 1) * pagination.pageSize,
      ]),
    ]);
    const total = count.rows[0].total;
    return {
      items: result.rows.map(convert),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }
  enrollmentPage(accountId: string, pagination: PageRequest) {
    const filter =
      " WHERE enrollment.account_id=$1 AND course.status='PUBLISHED' AND EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id)";
    return this.readPage<EnrollmentRow, Enrollment>(
      `${enrollmentSelect} JOIN courses course ON course.id=enrollment.course_id${filter} ORDER BY enrollment.enrolled_at DESC,enrollment.id`,
      `SELECT count(*)::int AS total FROM enrollments enrollment JOIN courses course ON course.id=enrollment.course_id${filter}`,
      [accountId],
      pagination,
      enrollment,
    );
  }
  favoritePage(accountId: string, search: CourseSearch) {
    const source = `FROM favorites favorite JOIN courses course ON course.id=favorite.course_id JOIN subjects subject ON subject.id=course.subject_id JOIN instructors instructor ON instructor.id=course.instructor_id`;
    const filter = `WHERE favorite.account_id=$1 AND course.status='PUBLISHED' AND EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id)
      AND ($2::text IS NULL OR concat_ws(' ',course.title,course.description,subject.name,instructor.display_name) ILIKE $2 ESCAPE '\\')
      AND ($3::text IS NULL OR course.subject_id=$3) AND ($4::text IS NULL OR course.school_level=$4) AND ($5::boolean IS NULL OR course.featured=$5)`;
    const ordering = {
      TITLE: 'course.title,course.id',
      NEWEST: 'course.published_at DESC,course.id',
      RATING: 'course.title,course.id',
      POPULAR: '(SELECT count(*) FROM enrollments WHERE course_id=course.id) DESC,course.id',
    }[search.sort];
    const values = [
      accountId,
      search.q ? `%${search.q.replace(/[\\%_]/g, '\\$&')}%` : null,
      search.subjectId ?? null,
      search.schoolLevel ?? null,
      search.featured ?? null,
    ];
    return this.readPage<
      { course_id: string; saved_at: Date },
      { courseId: string; savedAt: string }
    >(
      `SELECT favorite.* ${source} ${filter} ORDER BY ${ordering}`,
      `SELECT count(*)::int AS total ${source} ${filter}`,
      values,
      search,
      (row) => ({ courseId: row.course_id, savedAt: row.saved_at.toISOString() }),
    );
  }
  notebookPage(accountId: string, pagination: PageRequest) {
    const source = `FROM notes note JOIN courses course ON course.id=note.course_id JOIN lessons lesson ON lesson.id=note.lesson_id JOIN subjects subject ON subject.id=course.subject_id WHERE note.account_id=$1 AND note.text ~ '[^[:space:]]'`;
    return this.readPage<
      NoteRow & { course_title: string; lesson_title: string; subject: NotebookNote['subject'] },
      NotebookNote
    >(
      `SELECT note.*,course.title AS course_title,lesson.title AS lesson_title,json_build_object('id',subject.id,'code',subject.code,'name',subject.name) AS subject ${source} ORDER BY note.updated_at DESC,note.id`,
      `SELECT count(*)::int AS total ${source}`,
      [accountId],
      pagination,
      (row) => ({
        ...note(row),
        courseTitle: row.course_title,
        lessonTitle: row.lesson_title,
        subject: row.subject,
      }),
    );
  }
  attemptPage(accountId: string, pagination: PageRequest) {
    return this.readPage<{ summary: unknown }, ReturnType<typeof quizAttemptSummarySchema.parse>>(
      `SELECT result->'summary' AS summary FROM quiz_attempts WHERE account_id=$1 ORDER BY created_at DESC,id DESC`,
      'SELECT count(*)::int AS total FROM quiz_attempts WHERE account_id=$1',
      [accountId],
      pagination,
      (row) => quizAttemptSummarySchema.parse(row.summary),
    );
  }
  async counts(accountId: string): Promise<LearningCounts> {
    const result = await this.pool.query<LearningCounts>(
      `WITH library AS (SELECT enrollment.course_id,(SELECT count(*) FROM lessons WHERE course_id=enrollment.course_id) AS total,(SELECT count(*) FROM lesson_completions WHERE account_id=$1 AND course_id=enrollment.course_id) AS completed FROM enrollments enrollment JOIN courses course ON course.id=enrollment.course_id WHERE enrollment.account_id=$1 AND course.status='PUBLISHED')
      SELECT (SELECT count(*)::int FROM library WHERE total>0) AS "enrolledCourses",(SELECT count(*)::int FROM library WHERE total>0 AND completed=total) AS "completedCourses",(SELECT coalesce(sum(completed),0)::int FROM library) AS "completedLessons",
      (SELECT count(*)::int FROM favorites favorite JOIN courses course ON course.id=favorite.course_id WHERE account_id=$1 AND course.status='PUBLISHED' AND EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id)) AS favorites,
      (SELECT count(*)::int FROM notes WHERE account_id=$1 AND text ~ '[^[:space:]]') AS notes,
      (SELECT count(DISTINCT quiz_id)::int FROM quiz_attempts WHERE account_id=$1) AS "attemptedQuizzes"`,
      [accountId],
    );
    return result.rows[0];
  }
  async enroll(accountId: string, target: EnrollmentTarget, key: string) {
    return this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${accountId}:${target.kind}:${key}`,
      ]);
      const previous = await client.query<{ target_id: string; course_ids: string[] }>(
        'SELECT target_id,course_ids FROM learning_requests WHERE account_id=$1 AND scope=$2 AND request_key=$3',
        [accountId, target.kind, key],
      );
      if (previous.rows[0] && previous.rows[0].target_id !== target.id) {
        throw new DomainError(
          'CONFLICT',
          'Cette demande a déjà été utilisée pour une autre inscription.',
        );
      }
      const courseIds = previous.rows[0]?.course_ids ?? target.courseIds;
      const allowed = await client.query<{ id: string }>(
        "SELECT course.id FROM courses course WHERE course.id=ANY($1::varchar[]) AND course.status='PUBLISHED' AND EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id) ORDER BY course.id FOR SHARE",
        [courseIds],
      );
      if (allowed.rows.length !== courseIds.length) {
        throw new DomainError('CONFLICT', 'Un cours de cette inscription n’est plus disponible.');
      }
      for (const courseId of [...courseIds].sort()) {
        await client.query(
          'INSERT INTO enrollments(id,account_id,course_id) VALUES($1,$2,$3) ON CONFLICT(account_id,course_id) DO NOTHING',
          [randomUUID(), accountId, courseId],
        );
      }
      if (!previous.rows[0]) {
        await client.query(
          'INSERT INTO learning_requests(account_id,scope,request_key,target_id,course_ids) VALUES($1,$2,$3,$4,$5)',
          [accountId, target.kind, key, target.id, courseIds],
        );
      }
      const rows = await client.query<EnrollmentRow>(
        `${enrollmentSelect} WHERE enrollment.account_id=$1 AND enrollment.course_id=ANY($2::varchar[])`,
        [accountId, courseIds],
      );
      return rows.rows.map(enrollment);
    });
  }
  async enrollment(accountId: string, courseId: string) {
    const rows = await this.pool.query<EnrollmentRow>(
      `${enrollmentSelect} WHERE enrollment.account_id=$1 AND enrollment.course_id=$2`,
      [accountId, courseId],
    );
    return rows.rows[0] ? enrollment(rows.rows[0]) : null;
  }
  async enrollments(accountId: string, courseIds: string[]) {
    const rows = await this.pool.query<EnrollmentRow>(
      `${enrollmentSelect} WHERE enrollment.account_id=$1 AND enrollment.course_id=ANY($2::varchar[]) ORDER BY enrollment.enrolled_at DESC,enrollment.id`,
      [accountId, courseIds],
    );
    return rows.rows.map(enrollment);
  }
  async complete(accountId: string, courseId: string, lessonId: string, completed: boolean) {
    return this.transaction(async (client) => {
      const allowed = await client.query(
        "SELECT lesson.id FROM lessons lesson JOIN courses course ON course.id=lesson.course_id WHERE lesson.id=$1 AND course.id=$2 AND course.status='PUBLISHED' FOR SHARE OF course",
        [lessonId, courseId],
      );
      if (!allowed.rowCount) {
        throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable.');
      }
      await client.query(
        'INSERT INTO enrollments(id,account_id,course_id) VALUES($1,$2,$3) ON CONFLICT(account_id,course_id) DO NOTHING',
        [randomUUID(), accountId, courseId],
      );
      await client.query(
        'SELECT id FROM enrollments WHERE account_id=$1 AND course_id=$2 FOR UPDATE',
        [accountId, courseId],
      );
      if (completed) {
        await client.query(
          'INSERT INTO lesson_completions(account_id,course_id,lesson_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [accountId, courseId, lessonId],
        );
      } else {
        await client.query(
          'DELETE FROM lesson_completions WHERE account_id=$1 AND course_id=$2 AND lesson_id=$3',
          [accountId, courseId, lessonId],
        );
      }
      await client.query(
        `UPDATE enrollments SET updated_at=now(),completed_at=CASE WHEN NOT EXISTS(SELECT 1 FROM lessons lesson WHERE lesson.course_id=$2 AND NOT EXISTS(SELECT 1 FROM lesson_completions completion WHERE completion.account_id=$1 AND completion.lesson_id=lesson.id)) THEN coalesce(completed_at,now()) ELSE NULL END WHERE account_id=$1 AND course_id=$2`,
        [accountId, courseId],
      );
      const rows = await client.query<EnrollmentRow>(
        `${enrollmentSelect} WHERE enrollment.account_id=$1 AND enrollment.course_id=$2`,
        [accountId, courseId],
      );
      return enrollment(rows.rows[0]);
    });
  }
  async saveFavorite(accountId: string, courseId: string) {
    const result = await this.pool.query<{ saved_at: Date }>(
      'INSERT INTO favorites(account_id,course_id) VALUES($1,$2) ON CONFLICT(account_id,course_id) DO UPDATE SET saved_at=favorites.saved_at RETURNING saved_at',
      [accountId, courseId],
    );
    return { courseId, savedAt: result.rows[0].saved_at.toISOString() };
  }
  async deleteFavorite(accountId: string, courseId: string) {
    await this.pool.query('DELETE FROM favorites WHERE account_id=$1 AND course_id=$2', [
      accountId,
      courseId,
    ]);
  }
  async note(accountId: string, lessonId: string) {
    const rows = await this.pool.query<NoteRow>(
      'SELECT * FROM notes WHERE account_id=$1 AND lesson_id=$2',
      [accountId, lessonId],
    );
    return rows.rows[0] ? note(rows.rows[0]) : null;
  }
  async saveNote(
    accountId: string,
    courseId: string,
    lessonId: string,
    text: string,
    expectedVersion: number | null,
  ) {
    const result =
      expectedVersion === null
        ? await this.pool.query<NoteRow>(
            'INSERT INTO notes(id,account_id,course_id,lesson_id,text) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,lesson_id) DO NOTHING RETURNING *',
            [randomUUID(), accountId, courseId, lessonId, text],
          )
        : await this.pool.query<NoteRow>(
            'UPDATE notes SET text=$4,version=version+1,updated_at=now() WHERE account_id=$1 AND course_id=$2 AND lesson_id=$3 AND version=$5 RETURNING *',
            [accountId, courseId, lessonId, text, expectedVersion],
          );
    if (result.rows[0]) {
      return note(result.rows[0]);
    }
    const current = await this.note(accountId, lessonId);
    if (current?.text === text) {
      return current;
    }
    throw new DomainError(
      'REVISION_CONFLICT',
      'Cette note a été modifiée ailleurs. Rechargez la version enregistrée avant de la remplacer.',
    );
  }
  async resume(accountId: string) {
    const rows = await this.pool.query<{ course_id: string; lesson_id: string; visited_at: Date }>(
      "SELECT resume.* FROM learning_resume resume JOIN courses course ON course.id=resume.course_id WHERE resume.account_id=$1 AND course.status='PUBLISHED'",
      [accountId],
    );
    const row = rows.rows[0];
    return row
      ? {
          courseId: row.course_id,
          lessonId: row.lesson_id,
          visitedAt: row.visited_at.toISOString(),
        }
      : null;
  }
  async visit(accountId: string, courseId: string, lessonId: string): Promise<Resume> {
    const result = await this.pool.query<{ visited_at: Date }>(
      'INSERT INTO learning_resume(account_id,course_id,lesson_id) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET course_id=excluded.course_id,lesson_id=excluded.lesson_id,visited_at=now() RETURNING visited_at',
      [accountId, courseId, lessonId],
    );
    return { courseId, lessonId, visitedAt: result.rows[0].visited_at.toISOString() };
  }
}
