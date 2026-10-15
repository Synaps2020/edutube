import type { SchoolLevel } from './catalog';
export interface Account {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'LEARNER' | 'TEACHER' | 'ADMIN' | 'REGULATOR' | 'SUPER_ADMIN';
  schoolLevel: SchoolLevel | null;
}
export interface Session {
  tokenHash: string;
  account: Account;
  csrfToken: string;
  expiresAt: string;
}
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
