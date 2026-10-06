import { NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import { ApiError, errorResponse } from '@/lib/api';

interface OidcDiscovery {
  authorization_endpoint: string;
}

function base64Url(value: Buffer) {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET(req: Request) {
  try {
    const missingSsoSecret = !env.ssoClientSecret || env.ssoClientSecret.trim() === '' || env.ssoClientSecret === 'REMPLACER_PAR_LE_SECRET_ENTRA';
    if (!env.ssoEnabled || !env.ssoIssuer || !env.ssoClientId || missingSsoSecret) {
      throw new ApiError(503, 'La connexion SSO n’est pas encore configurée. Ajoutez le secret OIDC et vérifiez les variables SSO_*.', 'SSO_NON_CONFIGURE');
    }
    const discovery = await fetch(`${env.ssoIssuer.replace(/\/$/, '')}/.well-known/openid-configuration`, { cache: 'no-store' });
    if (!discovery.ok) throw new ApiError(502, 'Le fournisseur SSO est indisponible.', 'SSO_FOURNISSEUR_INDISPONIBLE');
    const { authorization_endpoint: authorizationEndpoint } = await discovery.json() as OidcDiscovery;
    const state = randomUUID();
    const nonce = randomUUID();
    const codeVerifier = base64Url(randomBytes(32));
    const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
    const params = new URLSearchParams({
      client_id: env.ssoClientId,
      redirect_uri: env.ssoRedirectUri,
      response_type: 'code',
      scope: env.ssoScopes,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    const response = NextResponse.redirect(`${authorizationEndpoint}?${params.toString()}`);
    const options = { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax' as const, path: '/', maxAge: 600 };
    response.cookies.set('edutube_sso_state', state, options);
    response.cookies.set('edutube_sso_nonce', nonce, options);
    response.cookies.set('edutube_sso_verifier', codeVerifier, options);
    return response;
  } catch (error) {
    const response = errorResponse(error);
    return NextResponse.redirect(new URL(`/connexion?erreur=${encodeURIComponent((await response.json()).error?.message ?? 'SSO indisponible')}`, req.url));
  }
}
