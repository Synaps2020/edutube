import { z } from 'zod';
export const videoLimit = 1024 * 1024 * 1024;
export const videoSchema = z
  .object({
    id: z.string().uuid(),
    courseId: z.string(),
    lessonId: z.string(),
    fileName: z.string(),
    sizeBytes: z.number().positive(),
    status: z.enum(['QUEUED', 'PROCESSING', 'READY', 'FAILED', 'REMOVED']),
    durationSeconds: z.number().positive().nullable(),
    errorMessage: z.string().nullable(),
    playbackUrl: z.string().nullable(),
    posterUrl: z.string().nullable(),
  })
  .strict();
export const videoStateSchema = z
  .object({ courseRevision: z.number().int().positive(), video: videoSchema.nullable() })
  .strict();
export const videoMutationSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
export const lessonAccessSchema = z
  .object({
    courseId: z.string(),
    passed: z.boolean(),
    passingScore: z.number().int(),
    lessons: z.array(
      z.object({ id: z.string(), locked: z.boolean(), requiresQuiz: z.boolean() }).strict(),
    ),
  })
  .strict();
export type VideoView = z.infer<typeof videoSchema>;

export type VideoState = z.infer<typeof videoStateSchema>;
export type LessonAccess = z.infer<typeof lessonAccessSchema>;
