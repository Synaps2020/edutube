import { prisma } from '@/lib/db';
import { handler, parseJson, created, rateLimit, ipOf, ApiError } from '@/lib/api';
import { hashPassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';

// POST /api/v1/auth/register — création de compte (enseignant ou élève)
export const POST = handler(async (req) => {
  rateLimit(`register:${ipOf(req)}`, env.rateLimitAuthMax);
  if (!env.allowSelfRegistration) throw new ApiError(403, 'Les inscriptions sont désactivées. Contactez votre IEF ou l’administrateur.', 'INSCRIPTIONS_FERMEES');
  const data = await parseJson(req, registerSchema);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new ApiError(409, 'Un compte existe déjà avec cette adresse e-mail.', 'CONFLIT');
  if (data.classLevelId) {
    const cl = await prisma.classLevel.findUnique({ where: { id: data.classLevelId } });
    if (!cl) throw new ApiError(422, 'Classe inconnue.', 'VALIDATION');
  }
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      classLevelId: data.role === 'STUDENT' ? data.classLevelId ?? null : null,
      establishment: data.establishment ?? null,
      region: data.region ?? null,
      ief: data.ief ?? null,
      ia: data.ia ?? null,
      lastLoginAt: new Date(),
    },
  });
  await setSessionCookie(user);
  await audit({ actorId: user.id, action: 'USER_REGISTER', entity: 'User', entityId: user.id, ip: ipOf(req) });
  return created(toSafeUser(user));
});
