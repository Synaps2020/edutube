import { prisma } from '@/lib/db';
import { handler, ok, notFound } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { audit, moderationDecision } from '@/lib/audit';

// POST /api/v1/admin/media/:id/restore — remettre en brouillon (depuis rejeté/archivé/échec) pour retraitement ou republication
export const POST = handler(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  const ready = (media.type === 'VIDEO' && media.hlsMasterPath) || (media.type === 'AUDIO' && media.audioPath);
  let status: 'DRAFT' | 'PROCESSING' = 'DRAFT';
  if (!ready && media.originalPath) {
    status = 'PROCESSING';
    await prisma.job.create({ data: { type: media.type === 'VIDEO' ? 'TRANSCODE_VIDEO' : 'PROCESS_AUDIO', mediaId: media.id, payload: { publishWhenDone: false } } });
  }
  await prisma.media.update({ where: { id: media.id }, data: { status, rejectionReason: null, processingError: null, archivedAt: null } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'MEDIA', targetId: media.id, action: 'RESTORE' });
  await audit({ actorId: admin.id, action: 'MEDIA_RESTORE', entity: 'Media', entityId: media.id });
  return ok({ status });
});
