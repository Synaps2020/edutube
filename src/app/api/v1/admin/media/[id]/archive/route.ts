import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { audit, moderationDecision } from '@/lib/audit';
import { z } from 'zod';

// POST /api/v1/admin/media/:id/archive — retirer de la diffusion (conservé)
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { reason } = await parseJson(req, z.object({ reason: z.string().max(2000).optional().nullable() }));
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  await prisma.media.update({ where: { id: media.id }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'MEDIA', targetId: media.id, action: 'ARCHIVE', reason });
  await audit({ actorId: admin.id, action: 'MEDIA_ARCHIVE', entity: 'Media', entityId: media.id, details: { reason } });
  return ok({ status: 'ARCHIVED' });
});
