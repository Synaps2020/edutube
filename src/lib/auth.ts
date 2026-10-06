import 'server-only';
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { Role, User } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// Jetons de session (JWT signé HS256, stocké en cookie httpOnly)
// Choix : JWT en cookie httpOnly + SameSite=Lax plutôt que localStorage, pour ne jamais exposer
// le jeton au JavaScript de la page (XSS). La protection CSRF repose sur SameSite + un en-tête
// personnalisé exigé sur les requêtes mutatives (voir api.ts).
// ---------------------------------------------------------------------------
const secretKey = new TextEncoder().encode(env.jwtSecret);

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  ver: number; // version de session (invalidation future)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, ver: payload.ver })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(env.appUrl)
    .setExpirationTime(`${env.sessionTtlHours}h`)
    .sign(secretKey);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { issuer: env.appUrl });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as Role, ver: Number(payload.ver ?? 1) };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.cookieSecure,
    path: '/',
    maxAge: env.sessionTtlHours * 3600,
  };
}

export async function setSessionCookie(user: Pick<User, 'id' | 'role'>) {
  const token = await signSession({ sub: user.id, role: user.role, ver: 1 });
  (await cookies()).set(env.cookieName, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  (await cookies()).set(env.cookieName, '', { ...sessionCookieOptions(), maxAge: 0 });
}

// ---------------------------------------------------------------------------
// Utilisateur courant
// ---------------------------------------------------------------------------
export type SafeUser = Omit<User, 'passwordHash'>;

export function toSafeUser(u: User): SafeUser {
  const rest = { ...u } as Partial<User>;
  delete rest.passwordHash;
  return rest as SafeUser;
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const token = (await cookies()).get(env.cookieName)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || user.status !== 'ACTIVE') return null;
  return toSafeUser(user);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Authentification requise.', 401);
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SafeUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError('Accès refusé : droits insuffisants.', 403);
  return user;
}

export const isAdmin = (u: SafeUser | null | undefined) => u?.role === 'ADMIN';
export const isTeacher = (u: SafeUser | null | undefined) => u?.role === 'TEACHER';

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim();
}

export async function userAgent(): Promise<string> {
  return (await headers()).get('user-agent') ?? '';
}
