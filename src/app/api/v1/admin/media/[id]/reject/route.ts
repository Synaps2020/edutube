import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { rejectSchema } from '@/lib/validation';
import { audit, moderationDecision } from '@/lib/audit';
import { notify } from '@/lib/notifications';

// POST /api/v1/admin/media/:id/reject — rejeter avec motif
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { reason } = await parseJson(req, rejectSchema);
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  await prisma.media.update({ where: { id: media.id }, data: { status: 'REJECTED', rejectionReason: reason } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'MEDIA', targetId: media.id, action: 'REJECT', reason });
  await audit({ actorId: admin.id, action: 'MEDIA_REJECT', entity: 'Media', entityId: media.id, details: { reason } });
  if (media.contributorId) await notify({ userId: media.contributorId, type: 'SUBMISSION_REJECTED', title: `Votre contenu « ${media.title} » n’a pas été retenu`, body: reason, link: '/mon-espace/propositions', email: true });
  return ok({ status: 'REJECTED' });
});
