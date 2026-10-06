import { prisma } from '@/lib/db';
import { handler, ok, noContent, notFound, parseJson, serialize } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { mediaUpdateSchema } from '@/lib/validation';
import { mediaDetailInclude, toDetail } from '@/lib/media';
import { removeRel } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/media/:id — détail complet (tous statuts) + jobs + historique de modération
export const GET = handler(async (_req, { params }) => {
  await requireRole('ADMIN');
  const media = await prisma.media.findUnique({ where: { id: params.id }, include: mediaDetailInclude });
  if (!media) throw notFound();
  const [jobs, decisions, submission] = await Promise.all([
    prisma.job.findMany({ where: { mediaId: media.id }, orderBy: { createdAt: 'desc' } }),
    prisma.moderationDecision.findMany({ where: { targetType: 'MEDIA', targetId: media.id }, include: { moderator: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.submission.findUnique({ where: { mediaId: media.id }, include: { author: { select: { firstName: true, lastName: true, role: true } } } }),
  ]);
  return ok(serialize({ media: { ...toDetail(media), originalName: media.originalName, originalSize: media.originalSize, originalPath: media.originalPath }, jobs, decisions, submission }));
});

// PATCH /api/v1/admin/media/:id — édition des métadonnées
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, mediaUpdateSchema);
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  const updated = await prisma.media.update({ where: { id: media.id }, data: { ...data, transcript: data.transcript === undefined ? undefined : data.transcript || null }, include: mediaDetailInclude });
  await audit({ actorId: admin.id, action: 'MEDIA_UPDATE', entity: 'Media', entityId: media.id, details: { fields: Object.keys(data) } });
  return ok(toDetail(updated));
});

// DELETE /api/v1/admin/media/:id — suppression définitive (fichiers inclus)
export const DELETE = handler(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  await prisma.submission.updateMany({ where: { mediaId: media.id }, data: { mediaId: null } });
  await prisma.media.delete({ where: { id: media.id } });
  await Promise.all([
    removeRel(`originals/${media.id}`), removeRel(`hls/${media.id}`), removeRel(`audio/${media.id}`),
    removeRel(media.thumbnailPath), removeRel(media.waveformPath), removeRel(media.subtitlesPath),
  ]);
  await audit({ actorId: admin.id, action: 'MEDIA_DELETE', entity: 'Media', entityId: media.id, details: { title: media.title } });
  return noContent();
});
