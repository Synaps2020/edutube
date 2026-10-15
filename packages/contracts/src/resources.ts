import { z } from 'zod';
import { resourceSchema } from './index';
export const resourceLimit = 10 * 1024 * 1024;
export const resourceUploadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const resourceRemoveSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
export const teachingResourcesSchema = z
  .object({
    courseRevision: z.number().int().positive(),
    resources: z.array(resourceSchema),
  })
  .strict();
export type ResourceUpload = z.infer<typeof resourceUploadSchema>;
export type TeachingResources = z.infer<typeof teachingResourcesSchema>;
