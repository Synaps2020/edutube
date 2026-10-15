import type { z } from 'zod';
import type { IdentityAccess } from '../../application/identity';
import {
  profileSchema,
  profileInputSchema,
  emailInputSchema,
  tokenInputSchema,
  resetInputSchema,
  noticeSchema,
  type ProfileInput,
} from '@edutube/contracts/identity';
import { httpClient } from './runtime';
function checked<Value>(schema: z.ZodType<Value>, value: unknown): Value {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error('Vérifiez les informations saisies et ouvrez un lien valide reçu par e-mail.');
  }
  return result.data;
}
export const identityService: IdentityAccess = {
  profile: (signal?: AbortSignal) => httpClient.request('/me/profile', profileSchema, { signal }),
  save: (input: ProfileInput) =>
    httpClient.request('/me/profile', profileSchema, {
      method: 'PUT',
      body: checked(profileInputSchema, input),
    }),
  requestVerification: () =>
    httpClient.request('/auth/verification/request', noticeSchema, { method: 'POST' }),
  verify: (token: string) =>
    httpClient.request('/auth/verification/confirm', noticeSchema, {
      method: 'POST',
      body: checked(tokenInputSchema, { token }),
    }),
  forgot: (email: string) =>
    httpClient.request('/auth/password/forgot', noticeSchema, {
      method: 'POST',
      body: checked(emailInputSchema, { email }),
    }),
  reset: (token: string, password: string) =>
    httpClient.request('/auth/password/reset', noticeSchema, {
      method: 'POST',
      body: checked(resetInputSchema, { token, password }),
    }),
};
