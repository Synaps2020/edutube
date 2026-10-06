import { prisma } from '@/lib/db';
import { handler, parseJson, ok, ApiError } from '@/lib/api';
import { getCurrentUser, requireUser, hashPassword, verifyPassword, toSafeUser } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/v1/auth/me — utilisateur courant (null si visiteur)
export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return ok(null);
  const [unread, classLevel] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    user.classLevelId ? prisma.classLevel.findUnique({ where: { id: user.classLevelId }, select: { code: true, name: true } }) : null,
  ]);
  return ok({ ...user, unreadNotifications: unread, classLevel });
});

// PATCH /api/v1/auth/me — mise à jour du profil / mot de passe
export const PATCH = handler(async (req) => {
  const me = await requireUser();
  const data = await parseJson(req, updateProfileSchema);
  const update: Record<string, unknown> = {};
  for (const k of ['firstName', 'lastName', 'locale', 'classLevelId', 'establishment', 'region', 'ief', 'ia', 'bio'] as const) {
    if (data[k] !== undefined) update[k] = data[k];
  }
  if (data.newPassword) {
    const full = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!data.currentPassword || !(await verifyPassword(data.currentPassword, full.passwordHash))) {
      throw new ApiError(400, 'Mot de passe actuel incorrect.', 'MOT_DE_PASSE_INCORRECT');
    }
    update.passwordHash = await hashPassword(data.newPassword);
    await audit({ actorId: me.id, action: 'USER_PASSWORD_CHANGE' });
  }
  const user = await prisma.user.update({ where: { id: me.id }, data: update });
  return ok(toSafeUser(user));
});
