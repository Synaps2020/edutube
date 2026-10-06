import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Garde d'accès des espaces protégés (vérification légère du jeton, sans accès base).
// La vérification complète (statut du compte, rôle) est refaite côté serveur dans les pages/API.
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-a-changer-absolument-en-production-0123456789');
const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'edu_session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = pathname.startsWith('/mon-espace') || pathname.startsWith('/admin') || pathname.startsWith('/soumettre');
  if (!needsAuth) return NextResponse.next();
  const token = req.cookies.get(COOKIE)?.value;
  let payload: { role?: string } | null = null;
  if (token) {
    try { payload = (await jwtVerify(token, secret)).payload as { role?: string }; } catch { payload = null; }
  }
  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = '/connexion';
    url.searchParams.set('suite', pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/mon-espace?acces=refuse', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/mon-espace/:path*', '/admin/:path*', '/soumettre'] };
