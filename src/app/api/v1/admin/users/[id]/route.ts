import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson, ApiError, serialize } from '@/lib/api';
import { requireRole, hashPassword, toSafeUser } from '@/lib/auth';
import { adminUserUpdateSchema } from '@/lib/validation';
import { audit, moderationDecision } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/users/:id — fiche utilisateur et activité
export const GET = handler(async (_req, { params }) => {
  await requireRole('ADMIN');
  const user = await prisma.user.findUnique({ where: { id: params.id }, include: { classLevel: true, channels: true, _count: { select: { submissions: true, comments: true, likes: true, watchHistory: true, reports: true } } } });
  if (!user) throw notFound();
  const [submissions, audits] = await Promise.all([
    prisma.submission.findMany({ where: { authorId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.auditLog.findMany({ where: { actorId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return ok(serialize({ ...toSafeUser(user), classLevel: user.classLevel, channels: user.channels, _count: user._count, submissions, audits }));
});

// PATCH /api/v1/admin/users/:id — rôle, statut, rattachement, réinitialisation de mot de passe
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, adminUserUpdateSchema);
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) throw notFound();
  if (user.id === admin.id && (data.role && data.role !== 'ADMIN' || data.status === 'SUSPENDED')) throw new ApiError(400, 'Vous ne pouvez pas retirer vos propres droits ni suspendre votre compte.', 'REQUETE_INVALIDE');
  const { newPassword, ...rest } = data;
  const updated = await prisma.user.update({ where: { id: user.id }, data: { ...rest, ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}) } });
  if (data.status && data.status !== user.status) await moderationDecision({ moderatorId: admin.id, targetType: 'USER', targetId: user.id, action: data.status === 'SUSPENDED' ? 'SUSPEND' : 'REACTIVATE' });
  await audit({ actorId: admin.id, action: 'USER_UPDATE', entity: 'User', entityId: user.id, details: { fields: Object.keys(rest), passwordReset: !!newPassword } });
  return ok(toSafeUser(updated));
});
