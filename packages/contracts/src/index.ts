import { z } from 'zod';
export const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/);
export const timestampSchema = z.string().datetime({ offset: true });
export const schoolLevelSchema = z.enum(['PRIMARY', 'MIDDLE', 'SECONDARY']);
const text = z.string().trim().min(1);
const revision = z.number().int().positive();
export const subjectSchema = z.object({ id: idSchema, code: text, name: text }).strict();
export const instructorSchema = z
  .object({
    id: idSchema,
    displayName: text,
    avatarUrl: z.string().url().nullable(),
    biography: z.string().max(2000).optional(),
  })
  .strict();
export const coverSchema = z
  .object({
    imageUrl: z.string().url().nullable(),
    alt: z.string(),
    illustration: z.enum(['geometry', 'plant', 'writing', 'code']).nullable(),
    palette: z.enum(['blue', 'green', 'orange', 'purple']),
  })
  .strict();
export const courseSummarySchema = z
  .object({
    id: idSchema,
    slug: text,
    title: text,
    shortDescription: text,
    subject: subjectSchema,
    schoolLevel: schoolLevelSchema,
    instructor: instructorSchema,
    durationMinutes: z.number().int().nonnegative(),
    lessonCount: z.number().int().nonnegative(),
    rating: z
      .object({
        average: z.number().min(0).max(5).nullable(),
        reviewCount: z.number().int().nonnegative(),
        enrollmentCount: z.number().int().nonnegative(),
      })
      .strict(),
    cover: coverSchema,
    featured: z.boolean(),
    publishedAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export const lessonSummarySchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    title: text,
    order: z.number().int().nonnegative(),
    kind: z.enum(['VIDEO', 'READING', 'PRACTICE']),
    estimatedMinutes: z.number().int().positive(),
    previewAllowed: z.boolean(),
    resourceCount: z.number().int().nonnegative(),
  })
  .strict();
export const courseDetailSchema = courseSummarySchema
  .extend({
    revision,
    description: text,
    outcomes: z.array(text).min(1),
    prerequisites: z.array(text),
    language: z.enum(['fr', 'wo', 'ar', 'en']),
    lessons: z.array(lessonSummarySchema).min(1),
  })
  .superRefine((course, context) => {
    const ids = course.lessons.map((lesson) => lesson.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate lesson IDs', path: ['lessons'] });
    }
    if (course.lessons.some((lesson) => lesson.courseId !== course.id)) {
      context.addIssue({
        code: 'custom',
        message: 'Lesson belongs to another course',
        path: ['lessons'],
      });
    }
    if (course.lessonCount !== course.lessons.length) {
      context.addIssue({
        code: 'custom',
        message: 'Inconsistent lesson count',
        path: ['lessonCount'],
      });
    }
  });
export const pathSummarySchema = z
  .object({
    id: idSchema,
    slug: text,
    title: text,
    description: text,
    goal: z.enum(['EXAM', 'DISCOVERY', 'FOUNDATIONS']),
    schoolLevels: z.array(schoolLevelSchema).min(1),
    courseCount: z.number().int().positive(),
    durationMinutes: z.number().int().nonnegative(),
    cover: coverSchema,
  })
  .strict();
export const pathStepSchema = z
  .object({ id: idSchema, order: z.number().int().nonnegative(), course: courseSummarySchema })
  .strict();
export const pathDetailSchema = pathSummarySchema
  .extend({ revision, steps: z.array(pathStepSchema).min(1) })
  .superRefine((path, context) => {
    if (path.courseCount !== path.steps.length) {
      context.addIssue({
        code: 'custom',
        message: 'Inconsistent course count',
        path: ['courseCount'],
      });
    }
    if (new Set(path.steps.map((study) => study.course.id)).size !== path.steps.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate course in path', path: ['steps'] });
    }
  });
export const enrollmentSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    status: z.enum(['ACTIVE', 'COMPLETED']),
    enrolledAt: timestampSchema,
    completedAt: timestampSchema.nullable(),
  })
  .strict();
export const courseProgressSchema = z
  .object({
    courseId: idSchema,
    curriculumRevision: revision,
    completedLessonIds: z.array(idSchema),
    totalLessons: z.number().int().positive(),
    percent: z.number().int().min(0).max(100),
    nextLessonId: idSchema.nullable(),
    updatedAt: timestampSchema,
  })
  .strict()
  .superRefine((lesson, context) => {
    if (
      new Set(lesson.completedLessonIds).size !== lesson.completedLessonIds.length ||
      lesson.completedLessonIds.length > lesson.totalLessons ||
      lesson.percent !== Math.round((lesson.completedLessonIds.length / lesson.totalLessons) * 100)
    ) {
      context.addIssue({ code: 'custom', message: 'Inconsistent progress' });
    }
  });
export const lessonProgressSchema = z
  .object({
    courseId: idSchema,
    lessonId: idSchema,
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
    completedAt: timestampSchema.nullable(),
    updatedAt: timestampSchema,
  })
  .strict();
export const resumeSchema = z
  .object({ courseId: idSchema, lessonId: idSchema, visitedAt: timestampSchema })
  .strict();
export const pathProgressSchema = z
  .object({
    pathId: idSchema,
    percent: z.number().int().min(0).max(100),
    courseProgress: z.array(courseProgressSchema),
    nextCourseId: idSchema.nullable(),
    nextLessonId: idSchema.nullable(),
  })
  .strict();
export const favoriteSchema = z
  .object({ course: courseSummarySchema, savedAt: timestampSchema })
  .strict();
export const noteSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    lessonId: idSchema,
    text: z.string().max(20000),
    version: revision,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export const noteSummarySchema = noteSchema.extend({
  courseTitle: text,
  lessonTitle: text,
  subject: subjectSchema,
});
export const resourceSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    lessonId: idSchema,
    title: text,
    mediaType: text,
    sizeBytes: z.number().int().nonnegative().nullable(),
    fileName: text,
  })
  .strict();
export const lessonContentSchema = z
  .object({
    lesson: lessonSummarySchema,
    revision,
    blocks: z.array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('PARAGRAPH'), text: text }).strict(),
        z.object({ type: z.literal('EXAMPLE'), title: text, text: text }).strict(),
      ]),
    ),
    resources: z.array(resourceSchema),
  })
  .strict();
export const quizQuestionSchema = z
  .object({
    id: idSchema,
    prompt: text,
    options: z.array(z.object({ id: idSchema, text: text }).strict()).min(2),
  })
  .strict();
export const quizSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    revision,
    title: text,
    questions: z.array(quizQuestionSchema).min(1),
  })
  .strict();
export const quizAttemptSummarySchema = z
  .object({
    id: idSchema,
    quizId: idSchema,
    quizRevision: revision,
    courseId: idSchema,
    submittedAt: timestampSchema,
    correctCount: z.number().int().nonnegative(),
    questionCount: z.number().int().positive(),
    scorePercent: z.number().int().min(0).max(100),
  })
  .strict()
  .superRefine((attempt, context) => {
    if (
      attempt.correctCount > attempt.questionCount ||
      attempt.scorePercent !== Math.round((attempt.correctCount / attempt.questionCount) * 100)
    ) {
      context.addIssue({ code: 'custom', message: 'Inconsistent quiz score' });
    }
  });
export const quizAttemptSchema = z
  .object({
    summary: quizAttemptSummarySchema,
    corrections: z.array(
      z
        .object({
          questionId: idSchema,
          selectedOptionId: idSchema,
          correctOptionId: idSchema,
          correct: z.boolean(),
          explanation: text,
        })
        .strict(),
    ),
  })
  .strict();
export const learnerSchema = z
  .object({
    id: idSchema,
    displayName: text,
    schoolLevel: schoolLevelSchema.nullable(),
    role: z.enum(['LEARNER', 'TEACHER', 'ADMIN', 'REGULATOR', 'SUPER_ADMIN']).default('LEARNER'),
  })
  .strict();
export const enrollmentViewSchema = z
  .object({
    enrollment: enrollmentSchema,
    course: courseSummarySchema,
    progress: courseProgressSchema,
  })
  .strict();
export const dashboardSchema = z
  .object({
    learner: learnerSchema,
    counts: z
      .object({
        enrolledCourses: z.number().int().nonnegative(),
        completedCourses: z.number().int().nonnegative(),
        completedLessons: z.number().int().nonnegative(),
        favorites: z.number().int().nonnegative(),
        notes: z.number().int().nonnegative(),
        attemptedQuizzes: z.number().int().nonnegative(),
      })
      .strict(),
    resume: resumeSchema.nullable(),
    recentEnrollments: z.array(enrollmentViewSchema),
    latestAttempts: z.array(quizAttemptSummarySchema),
    generatedAt: timestampSchema,
  })
  .strict();
export const taxonomySchema = z
  .object({
    subjects: z.array(subjectSchema),
    schoolLevels: z.array(z.object({ code: schoolLevelSchema, label: text }).strict()),
  })
  .strict();
export const paginationSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();
export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), pagination: paginationSchema }).strict();
}
export const pageQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(24),
});
export const courseQuerySchema = pageQuerySchema
  .extend({
    q: z.string().trim().max(200).optional(),
    subjectId: idSchema.optional(),
    schoolLevel: schoolLevelSchema.optional(),
    sort: z.enum(['POPULAR', 'RATING', 'NEWEST', 'TITLE']).default('POPULAR'),
    featured: z.boolean().optional(),
  })
  .strict();
export const pathQuerySchema = pageQuerySchema
  .extend({
    schoolLevel: schoolLevelSchema.optional(),
    goal: z.enum(['EXAM', 'DISCOVERY', 'FOUNDATIONS']).optional(),
  })
  .strict();
export const enrollmentInputSchema = z.object({ courseId: idSchema }).strict();
export const pathEnrollmentInputSchema = z.object({ pathId: idSchema }).strict();
export const progressInputSchema = z.object({ completed: z.boolean() }).strict();
export const resumeInputSchema = z.object({ courseId: idSchema, lessonId: idSchema }).strict();
export const noteInputSchema = z
  .object({ text: z.string().max(20000), expectedVersion: z.number().int().positive().nullable() })
  .strict();
export const attemptInputSchema = z
  .object({
    quizRevision: revision,
    answers: z.array(z.object({ questionId: idSchema, optionId: idSchema }).strict()).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.answers.map((answer) => answer.questionId)).size !== value.answers.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate answer', path: ['answers'] });
    }
  });
export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          'VALIDATION_ERROR',
          'TOO_LARGE',
          'UNAUTHENTICATED',
          'FORBIDDEN',
          'NOT_FOUND',
          'CONFLICT',
          'REVISION_CONFLICT',
          'RATE_LIMITED',
          'INTERNAL_ERROR',
        ]),
        message: text,
        requestId: text,
        details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
      })
      .strict(),
  })
  .strict();
export type CourseSummaryDto = z.infer<typeof courseSummarySchema>;
export type CourseDetailDto = z.infer<typeof courseDetailSchema>;
export type LearningPathSummaryDto = z.infer<typeof pathSummarySchema>;
export type LearningPathDetailDto = z.infer<typeof pathDetailSchema>;
export type EnrollmentDto = z.infer<typeof enrollmentSchema>;
export type EnrollmentViewDto = z.infer<typeof enrollmentViewSchema>;
export type CourseProgressDto = z.infer<typeof courseProgressSchema>;
export type LessonProgressDto = z.infer<typeof lessonProgressSchema>;
export type PathProgressDto = z.infer<typeof pathProgressSchema>;
export type FavoriteDto = z.infer<typeof favoriteSchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type NoteSummaryDto = z.infer<typeof noteSummarySchema>;
export type LessonContentDto = z.infer<typeof lessonContentSchema>;
export type QuizDto = z.infer<typeof quizSchema>;
export type QuizAttemptDto = z.infer<typeof quizAttemptSchema>;
export type QuizAttemptSummaryDto = z.infer<typeof quizAttemptSummarySchema>;
export type LearnerDto = z.infer<typeof learnerSchema>;
export type DashboardDto = z.infer<typeof dashboardSchema>;
export type TaxonomyDto = z.infer<typeof taxonomySchema>;
export type ResumeDto = z.infer<typeof resumeSchema>;
export type ResourceDto = z.infer<typeof resourceSchema>;
export type ApiPage<T> = { items: T[]; pagination: z.infer<typeof paginationSchema> };
export type CourseQuery = z.input<typeof courseQuerySchema>;
export type PathQuery = z.input<typeof pathQuerySchema>;
export type PageQuery = z.input<typeof pageQuerySchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type QuizAttemptInput = z.infer<typeof attemptInputSchema>;

export const sessionSchema = z
  .object({ learner: learnerSchema, csrfToken: z.string().min(1), expiresAt: timestampSchema })
  .strict();
export type SessionDto = z.infer<typeof sessionSchema>;

export const loginInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(200),
  })
  .strict();
export const registerInputSchema = loginInputSchema.extend({
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(200),
  schoolLevel: schoolLevelSchema.nullable().optional(),
});
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
