import { z } from 'zod';
export const profileSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string(),
    schoolLevel: z.enum(['PRIMARY', 'MIDDLE', 'SECONDARY']).nullable(),
    biography: z.string(),
    emailVerified: z.boolean(),
    version: z.number().int().positive(),
  })
  .strict();
export const profileInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    schoolLevel: z.enum(['PRIMARY', 'MIDDLE', 'SECONDARY']).nullable(),
    biography: z.string().trim().max(2000),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const emailInputSchema = z.object({ email: z.string().trim().email().max(254) }).strict();
export const tokenInputSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const resetInputSchema = tokenInputSchema.extend({ password: z.string().min(12).max(200) });
export const noticeSchema = z.object({ message: z.string() }).strict();
export type Profile = z.infer<typeof profileSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
