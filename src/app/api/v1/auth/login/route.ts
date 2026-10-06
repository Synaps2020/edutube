import { prisma } from '@/lib/db';
import { handler, parseJson, ok, rateLimit, ipOf, ApiError } from '@/lib/api';
import { verifyPassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';

// POST /api/v1/auth/login
export const POST = handler(async (req) => {
  rateLimit(`login:${ipOf(req)}`, env.rateLimitAuthMax);
  const { email, password } = await parseJson(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  // Réponse identique que le compte existe ou non (pas d'énumération de comptes)
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    await audit({ action: 'USER_LOGIN_FAILED', details: { email }, ip: ipOf(req) });
    throw new ApiError(401, 'Adresse e-mail ou mot de passe incorrect.', 'IDENTIFIANTS_INVALIDES');
  }
  if (user.status === 'SUSPENDED') throw new ApiError(403, 'Ce compte est suspendu. Contactez l’administrateur de la plateforme.', 'COMPTE_SUSPENDU');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(user);
  await audit({ actorId: user.id, action: 'USER_LOGIN', ip: ipOf(req), userAgent: req.headers.get('user-agent') ?? undefined });
  return ok(toSafeUser(user));
});
