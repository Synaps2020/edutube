import { prisma } from '@/lib/db';
import { handler, ok, notFound, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { audit, moderationDecision } from '@/lib/audit';
import { notify } from '@/lib/notifications';

// POST /api/v1/admin/media/:id/publish — publier un contenu prêt (brouillon / en attente / archivé)
export const POST = handler(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  const ready = (media.type === 'VIDEO' && media.hlsMasterPath) || (media.type === 'AUDIO' && media.audioPath);
  if (!ready) throw new ApiError(409, 'Le contenu n’est pas encore prêt (transcodage non terminé).', 'NON_PRET');
  const updated = await prisma.media.update({ where: { id: media.id }, data: { status: 'PUBLISHED', publishedAt: media.publishedAt ?? new Date(), archivedAt: null, rejectionReason: null } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'MEDIA', targetId: media.id, action: 'PUBLISH' });
  await audit({ actorId: admin.id, action: 'MEDIA_PUBLISH', entity: 'Media', entityId: media.id });
  if (media.contributorId) await notify({ userId: media.contributorId, type: 'MEDIA_PUBLISHED', title: `Votre contenu « ${media.title} » est publié`, link: `/media/${media.slug}`, email: true });
  return ok({ status: updated.status, publishedAt: updated.publishedAt });
});
