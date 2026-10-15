import type { Pool } from 'pg';
import type {
  ChapterAccessRepository,
  ChapterAccessRecord,
} from '../../application/chapter-access';
export class PostgresChapterAccess implements ChapterAccessRepository {
  constructor(private pool: Pool) {}
  async read(courseId: string, accountId: string | null) {
    const result = await this.pool.query<{
      id: string;
      owner_id: string | null;
      status: string;
      enrolled: boolean;
      passed: boolean;
      passing_score: number;
      lessons: ChapterAccessRecord['lessons'];
    }>(
      `SELECT course.id,course.owner_id,course.status,coalesce(quiz.passing_score,70) AS passing_score,
   EXISTS(SELECT 1 FROM enrollments WHERE account_id=$2 AND course_id=course.id) AS enrolled,
   EXISTS(SELECT 1 FROM quiz_attempts attempt WHERE attempt.account_id=$2 AND attempt.quiz_id=quiz.id AND (attempt.result->'summary'->>'quizRevision')::integer=quiz.revision AND (attempt.result->'summary'->>'scorePercent')::integer>=quiz.passing_score) AS passed,
   (SELECT coalesce(json_agg(json_build_object('id',lesson.id,'position',lesson.position,'previewAllowed',lesson.preview_allowed,'requiresQuiz',lesson.requires_quiz) ORDER BY lesson.position),'[]'::json) FROM lessons lesson WHERE lesson.course_id=course.id) AS lessons
   FROM courses course LEFT JOIN quizzes quiz ON quiz.course_id=course.id WHERE course.id=$1 AND course.moderation='CLEAR'`,
      [courseId, accountId],
    );
    const course = result.rows[0];
    if (!course) {
      return null;
    }
    return {
      courseId,
      ownerId: course.owner_id,
      status: course.status,
      enrolled: course.enrolled,
      passed: course.passed,
      passingScore: course.passing_score,
      lessons: course.lessons,
    };
  }
  async courseForLesson(lessonId: string) {
    return (
      (
        await this.pool.query<{ course_id: string }>('SELECT course_id FROM lessons WHERE id=$1', [
          lessonId,
        ])
      ).rows[0]?.course_id ?? null
    );
  }
  async chapterForResource(resourceId: string) {
    return (
      (
        await this.pool.query<{ courseId: string; lessonId: string }>(
          'SELECT course_id AS "courseId",lesson_id AS "lessonId" FROM resources WHERE id=$1',
          [resourceId],
        )
      ).rows[0] ?? null
    );
  }
}
