import { z } from 'zod';
import { idSchema, lessonContentSchema } from './index';
const title = z.string().trim().min(1).max(200);
const content = z.string().trim().min(1).max(20000);
export const teachingLessonSchema = z
  .object({
    id: idSchema,
    title,
    kind: z.enum(['VIDEO', 'READING', 'PRACTICE']),
    estimatedMinutes: z.number().int().min(1).max(600),
    previewAllowed: z.boolean(),
    requiresQuiz: z.boolean().default(false),
    blocks: lessonContentSchema.shape.blocks.min(1).max(50),
  })
  .strict();
export const teachingQuestionSchema = z
  .object({
    id: idSchema,
    prompt: content,
    options: z
      .array(z.object({ id: idSchema, text: title }).strict())
      .min(2)
      .max(6),
    correctOptionId: idSchema,
    explanation: content,
  })
  .strict()
  .superRefine((question, context) => {
    if (
      new Set(question.options.map((option) => option.id)).size !== question.options.length ||
      !question.options.some((option) => option.id === question.correctOptionId)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Choisissez une réponse correcte parmi des choix distincts.',
      });
    }
  });
export const teachingContentSchema = z
  .object({
    title,
    shortDescription: z.string().trim().min(1).max(500),
    description: content,
    subjectId: idSchema,
    schoolLevel: z.enum(['PRIMARY', 'MIDDLE', 'SECONDARY']),
    language: z.enum(['fr', 'wo', 'ar', 'en']),
    palette: z.enum(['blue', 'green', 'orange', 'purple']),
    illustration: z.enum(['geometry', 'plant', 'writing', 'code']),
    outcomes: z.array(title).min(1).max(20),
    prerequisites: z.array(title).max(20),
    lessons: z.array(teachingLessonSchema).max(100),
    quiz: z
      .object({
        title,
        passingScore: z.number().int().min(1).max(100).default(70),
        questions: z.array(teachingQuestionSchema).min(1).max(50),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const teachingCourseSchema = teachingContentSchema.extend({
  id: idSchema,
  revision: z.number().int().positive(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  updatedAt: z.string().datetime(),
});
export const teachingSaveSchema = teachingContentSchema.extend({
  expectedRevision: z.number().int().positive(),
});
export const teachingStatusSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  })
  .strict();
export type TeachingContent = z.infer<typeof teachingContentSchema>;
export type TeachingCourse = z.infer<typeof teachingCourseSchema>;

export const teachingSummarySchema = teachingCourseSchema
  .pick({ id: true, title: true, revision: true, status: true, updatedAt: true })
  .extend({ lessonCount: z.number().int().nonnegative() });
export type TeachingSummary = z.infer<typeof teachingSummarySchema>;
