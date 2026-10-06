import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ipOf } from '@/lib/api';

interface OidcDiscovery {
  token_endpoint: string;
  jwks_uri: string;
}

interface OidcTokenResponse {
  access_token?: string;
  id_token?: string;
}

function redirectError(req: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/connexion?erreur=${encodeURIComponent(message)}`, req.url));
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const storedState = req.cookies.get('edutube_sso_state')?.value;
  const storedNonce = req.cookies.get('edutube_sso_nonce')?.value;
  const codeVerifier = req.cookies.get('edutube_sso_verifier')?.value;
  if (params.get('error')) return redirectError(req, 'La connexion SSO a été annulée.');
  if (!env.ssoEnabled || !code || !state || !storedState || state !== storedState || !storedNonce || !codeVerifier) return redirectError(req, 'La session SSO est invalide ou expirée.');

  try {
    const issuer = env.ssoIssuer.replace(/\/$/, '');
    const discoveryResponse = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
    if (!discoveryResponse.ok) return redirectError(req, 'Le fournisseur SSO est indisponible.');
    const discovery = await discoveryResponse.json() as OidcDiscovery;
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: env.ssoClientId,
        client_secret: env.ssoClientSecret,
        redirect_uri: env.ssoRedirectUri,
        code_verifier: codeVerifier,
      }),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) return redirectError(req, 'Le fournisseur SSO a refusé la connexion.');
    const tokens = await tokenResponse.json() as OidcTokenResponse;
    if (!tokens.id_token) return redirectError(req, 'Le fournisseur SSO n’a pas retourné d’identité.');

    const keys = createRemoteJWKSet(new URL(discovery.jwks_uri));
    const verified = await jwtVerify(tokens.id_token, keys, { issuer, audience: env.ssoClientId });
    const claims = verified.payload;
    if (claims.nonce !== storedNonce) return redirectError(req, 'La réponse SSO est invalide.');
    const emailClaim = typeof claims.email === 'string' ? claims.email : claims.preferred_username;
    const email = typeof emailClaim === 'string' ? emailClaim.trim().toLowerCase() : '';
    if (!email) return redirectError(req, 'Votre compte SSO ne fournit pas d’adresse e-mail.');
    const ssoRole = env.ssoAdminEmails.includes(email) ? 'ADMIN' : 'STUDENT';

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!env.ssoAutoProvision) return redirectError(req, 'Votre compte n’est pas encore autorisé sur cette plateforme.');
      const firstName = typeof claims.given_name === 'string' ? claims.given_name : typeof claims.name === 'string' ? claims.name : 'Utilisateur';
      const lastName = typeof claims.family_name === 'string' ? claims.family_name : '';
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          role: ssoRole,
          passwordHash: await hashPassword(`sso-${randomUUID()}`),
          lastLoginAt: new Date(),
        },
      });
    } else {
      if (user.status === 'SUSPENDED') return redirectError(req, 'Ce compte est suspendu. Contactez l’administrateur.');
      user = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), ...(ssoRole === 'ADMIN' ? { role: 'ADMIN' } : {}) } });
    }

    await setSessionCookie(user);
    await audit({ actorId: user.id, action: 'USER_SSO_LOGIN', ip: ipOf(req), userAgent: req.headers.get('user-agent') ?? undefined });
    const destination = user.role === 'ADMIN' ? '/admin' : '/mon-espace';
    const response = NextResponse.redirect(new URL(destination, req.url));
    response.cookies.set('edutube_sso_state', '', { path: '/', maxAge: 0 });
    response.cookies.set('edutube_sso_nonce', '', { path: '/', maxAge: 0 });
    response.cookies.set('edutube_sso_verifier', '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('[sso] callback error', error);
    return redirectError(req, 'Impossible de finaliser la connexion SSO.');
  }
}
