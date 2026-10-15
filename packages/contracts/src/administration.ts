import { z } from 'zod';
export const accountRoleSchema = z.enum([
  'LEARNER',
  'TEACHER',
  'ADMIN',
  'REGULATOR',
  'SUPER_ADMIN',
]);
export const adminAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: accountRoleSchema,
  suspended: z.boolean(),
  verified: z.boolean(),
  revision: z.number().int(),
});
export const adminCourseSchema = z.object({
  subject: z.string(),
  schoolLevel: z.enum(['PRIMARY', 'MIDDLE', 'SECONDARY']),
  palette: z.enum(['blue', 'green', 'orange', 'purple']),
  illustration: z.enum(['geometry', 'plant', 'writing', 'code']).nullable(),
  lessonCount: z.number().int(),
  durationMinutes: z.number().int(),
  learners: z.number().int(),
  updatedAt: z.string(),
  id: z.string(),
  title: z.string(),
  owner: z.string().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  moderation: z.enum(['CLEAR', 'WITHDRAWN', 'DELETED']),
  revision: z.number().int(),
});
export const auditEntrySchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  reason: z.string(),
  before: z.record(z.unknown()).nullable(),
  after: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  requestId: z.string(),
});
export const adminQuerySchema = z.object({
  filter: z
    .enum([
      'all',
      'active',
      'suspended',
      'unverified',
      'LEARNER',
      'TEACHER',
      'ADMIN',
      'REGULATOR',
      'SUPER_ADMIN',
      'PUBLISHED',
      'DRAFT',
      'ARCHIVED',
      'moderated',
      'video_failed',
      'video_processing',
      'video_ready',
    ])
    .optional(),
  query: z.string().max(100).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const accountChangeSchema = z.object({
  role: accountRoleSchema,
  suspended: z.boolean(),
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(10).max(1000),
});
export const moderationSchema = z.object({
  action: z.enum(['WITHDRAW', 'DELETE', 'RESTORE']),
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(10).max(1000),
});
export const accountCreateSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(100),
  role: accountRoleSchema,
  reason: z.string().trim().min(10).max(1000),
});
export const adminAccountsSchema = z.object({
  items: z.array(adminAccountSchema),
  total: z.number().int(),
});
export const adminCoursesSchema = z.object({
  items: z.array(adminCourseSchema),
  total: z.number().int(),
});
export const adminJournalSchema = z.object({
  items: z.array(auditEntrySchema),
  total: z.number().int(),
});
export type AdminQuery = z.infer<typeof adminQuerySchema>;
export type AccountChange = z.infer<typeof accountChangeSchema>;
export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type Moderation = z.infer<typeof moderationSchema>;
export type AdminAccount = z.infer<typeof adminAccountSchema>;
export type AdminCourse = z.infer<typeof adminCourseSchema>;
export type AdminJournal = z.infer<typeof adminJournalSchema>;

export const adminOverviewSchema = z.object({
  accounts: z
    .object({
      total: z.number().int(),
      active: z.number().int(),
      suspended: z.number().int(),
      unverified: z.number().int(),
      teachers: z.number().int(),
      regulators: z.number().int(),
    })
    .nullable(),
  courses: z.object({
    total: z.number().int(),
    published: z.number().int(),
    draft: z.number().int(),
    archived: z.number().int(),
    withdrawn: z.number().int(),
    deleted: z.number().int(),
  }),
  videos: z.object({
    ready: z.number().int(),
    processing: z.number().int(),
    failed: z.number().int(),
  }),
  learning: z.object({ enrollments: z.number().int(), completions: z.number().int() }),
  activity: z.array(
    z.object({ date: z.string(), changes: z.number().int(), reviews: z.number().int() }),
  ),
  recent: z.array(auditEntrySchema),
  updatedAt: z.string(),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
