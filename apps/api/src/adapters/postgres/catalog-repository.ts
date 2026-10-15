import type { Resource } from '../../domain/resources';
import type { Pool } from 'pg';
import type { CatalogRepository } from '../../application/ports';
import type {
  CourseSearch,
  PathSearch,
  CourseSummary,
  PublishedCourse,
  LearningPath,
  LessonContent,
  Subject,
  LessonSummary,
  Cover,
} from '../../domain/catalog';
interface CourseRow {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  school_level: CourseSummary['schoolLevel'];
  language: PublishedCourse['language'];
  revision: number;
  outcomes: string[];
  prerequisites: string[];
  palette: Cover['palette'];
  illustration: Cover['illustration'];
  image_url: string | null;
  featured: boolean;
  published_at: Date;
  updated_at: Date;
  subject: Subject;
  instructor: CourseSummary['instructor'];
  duration_minutes: number;
  lesson_count: number;
  enrollment_count: number;
}
interface LessonRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
  kind: LessonSummary['kind'];
  estimated_minutes: number;
  preview_allowed: boolean;
  revision: number;
  blocks: LessonContent['blocks'];
  resources?: Resource[];
}
interface PathRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  goal: LearningPath['goal'];
  revision: number;
  palette: Cover['palette'];
}
const courseSelect = `SELECT course.*,
  (SELECT count(*)::int FROM enrollments WHERE course_id=course.id) AS enrollment_count,
  json_build_object('id',subject.id,'code',subject.code,'name',subject.name) AS subject,
  json_build_object('id',instructor.id,'displayName',instructor.display_name,'avatarUrl',instructor.avatar_url,'biography',instructor.biography) AS instructor,
  (SELECT coalesce(sum(estimated_minutes),0)::int FROM lessons WHERE course_id=course.id) AS duration_minutes,
  (SELECT count(*)::int FROM lessons WHERE course_id=course.id) AS lesson_count
  FROM courses course JOIN subjects subject ON subject.id=course.subject_id
  JOIN instructors instructor ON instructor.id=course.instructor_id`;
function summary(row: CourseRow): CourseSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    subject: row.subject,
    schoolLevel: row.school_level,
    instructor: row.instructor,
    durationMinutes: row.duration_minutes,
    lessonCount: row.lesson_count,
    rating: { average: null, reviewCount: 0, enrollmentCount: row.enrollment_count },
    cover: {
      imageUrl: row.image_url,
      alt: row.title,
      palette: row.palette,
      illustration: row.illustration,
    },
    featured: row.featured,
    publishedAt: row.published_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function lessonSummary(row: LessonRow): LessonSummary {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    order: row.position,
    kind: row.kind,
    estimatedMinutes: row.estimated_minutes,
    previewAllowed: row.preview_allowed,
    resourceCount: 0,
  };
}
export class PostgresCatalog implements CatalogRepository {
  constructor(private pool: Pool) {}
  async listCourses(search: CourseSearch) {
    const values: unknown[] = [];
    const conditions = [
      "course.status='PUBLISHED'",
      'EXISTS (SELECT 1 FROM lessons WHERE course_id=course.id)',
    ];
    const where = (expression: string, value: unknown) => {
      values.push(value);
      conditions.push(expression.replace('?', `$${values.length}`));
    };
    if (search.q) {
      where(
        "concat_ws(' ',course.title,course.description,subject.name,instructor.display_name) ILIKE ? ESCAPE '\\'",
        `%${search.q.replace(/[\\%_]/g, '\\$&')}%`,
      );
    }
    if (search.subjectId) {
      where('course.subject_id=?', search.subjectId);
    }
    if (search.schoolLevel) {
      where('course.school_level=?', search.schoolLevel);
    }
    if (search.featured !== undefined) {
      where('course.featured=?', search.featured);
    }
    const filter = ` WHERE ${conditions.join(' AND ')}`;
    const count = await this.pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM courses course JOIN subjects subject ON subject.id=course.subject_id JOIN instructors instructor ON instructor.id=course.instructor_id ${filter}`,
      values,
    );
    const ordering = {
      POPULAR: 'enrollment_count DESC, course.featured DESC, course.title',
      RATING: 'course.title',
      NEWEST: 'course.published_at DESC',
      TITLE: 'course.title',
    }[search.sort];
    const rows = await this.pool.query<CourseRow>(
      `${courseSelect}${filter} ORDER BY ${ordering},course.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, search.pageSize, (search.page - 1) * search.pageSize],
    );
    const total = count.rows[0].total;
    return {
      items: rows.rows.map(summary),
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
        total,
        totalPages: Math.ceil(total / search.pageSize),
      },
    };
  }
  async getCourse(id: string) {
    return (await this.getCourses([id]))[0] ?? null;
  }
  async getCourses(ids: string[]): Promise<PublishedCourse[]> {
    if (!ids.length) {
      return [];
    }
    const result = await this.pool.query<CourseRow>(
      `${courseSelect} WHERE course.id=ANY($1::varchar[]) AND course.status='PUBLISHED' AND EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id)`,
      [ids],
    );
    const lessons = await this.pool.query<LessonRow>(
      'SELECT * FROM lessons WHERE course_id=ANY($1::varchar[]) ORDER BY course_id,position',
      [result.rows.map((course) => course.id)],
    );
    return result.rows.map((row) => ({
      ...summary(row),
      revision: row.revision,
      description: row.description,
      outcomes: row.outcomes,
      prerequisites: row.prerequisites,
      language: row.language,
      lessons: lessons.rows.filter((lesson) => lesson.course_id === row.id).map(lessonSummary),
    }));
  }
  async lessonCourse(lessonId: string) {
    const result = await this.pool.query<{ course_id: string }>(
      "SELECT lesson.course_id FROM lessons lesson JOIN courses course ON course.id=lesson.course_id WHERE lesson.id=$1 AND course.status='PUBLISHED'",
      [lessonId],
    );
    return result.rows[0]?.course_id ?? null;
  }
  async getLesson(courseId: string, lessonId: string) {
    const result = await this.pool.query<LessonRow>(
      `SELECT lesson.*, (SELECT coalesce(json_agg(json_build_object('id',resource.id,'courseId',resource.course_id,'lessonId',resource.lesson_id,'title',resource.title,'fileName',resource.file_name,'mediaType',resource.media_type,'sizeBytes',resource.size_bytes) ORDER BY resource.created_at,resource.id),'[]'::json) FROM resources resource WHERE resource.course_id=course.id AND resource.lesson_id=lesson.id AND resource.removed_at IS NULL) AS resources FROM lessons lesson JOIN courses course ON course.id=lesson.course_id WHERE course.status='PUBLISHED' AND course.id=$1 AND lesson.id=$2`,
      [courseId, lessonId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      lesson: lessonSummary(row),
      revision: row.revision,
      blocks: row.blocks,
      resources: row.resources ?? [],
    };
  }
  async subjects() {
    const result = await this.pool.query<Subject>(
      'SELECT id,code,name FROM subjects ORDER BY name',
    );
    return result.rows;
  }
  async listPaths(search: PathSearch) {
    const values = [search.goal ?? null, search.schoolLevel ?? null];
    const filter = `path.published AND ($1::text IS NULL OR path.goal=$1)
      AND NOT EXISTS (SELECT 1 FROM path_courses step JOIN courses course ON course.id=step.course_id WHERE step.path_id=path.id AND (course.status <> 'PUBLISHED' OR NOT EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id)))
      AND EXISTS (SELECT 1 FROM path_courses WHERE path_id=path.id)
      AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM path_courses step JOIN courses course ON course.id=step.course_id WHERE step.path_id=path.id AND course.school_level=$2))`;
    const count = await this.pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM learning_paths path WHERE ${filter}`,
      values,
    );
    const selected = await this.pool.query<PathRow>(
      `SELECT path.* FROM learning_paths path WHERE ${filter} ORDER BY path.id LIMIT $3 OFFSET $4`,
      [...values, search.pageSize, (search.page - 1) * search.pageSize],
    );
    const paths = await this.readPaths(selected.rows);
    const total = count.rows[0].total;
    return {
      items: paths,
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
        total,
        totalPages: Math.ceil(total / search.pageSize),
      },
    };
  }
  async getPath(id: string): Promise<LearningPath | null> {
    const result = await this.pool.query<PathRow>(
      `SELECT path.* FROM learning_paths path WHERE path.id=$1 AND path.published
      AND NOT EXISTS (SELECT 1 FROM path_courses step JOIN courses course ON course.id=step.course_id WHERE step.path_id=path.id AND (course.status <> 'PUBLISHED' OR NOT EXISTS(SELECT 1 FROM lessons WHERE course_id=course.id)))`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return (await this.readPaths([row]))[0] ?? null;
  }
  private async readPaths(rows: PathRow[]): Promise<LearningPath[]> {
    if (!rows.length) {
      return [];
    }
    const courses = await this.pool.query<CourseRow & { position: number; path_id: string }>(
      `${courseSelect.replace('SELECT course.*', 'SELECT course.*, step.position, step.path_id')} JOIN path_courses step ON step.course_id=course.id WHERE step.path_id=ANY($1::varchar[]) ORDER BY step.path_id, step.position`,
      [rows.map((row) => row.id)],
    );
    return rows.map((row) => {
      const steps = courses.rows.filter((course) => course.path_id === row.id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        goal: row.goal,
        revision: row.revision,
        schoolLevels: [...new Set(steps.map((course) => course.school_level))],
        courseCount: steps.length,
        durationMinutes: steps.reduce((total, course) => total + course.duration_minutes, 0),
        cover: { imageUrl: null, alt: row.title, illustration: null, palette: row.palette },
        steps: steps.map((course) => ({
          id: `${row.id}-${course.id}`,
          order: course.position,
          course: summary(course),
        })),
      };
    });
  }
}
