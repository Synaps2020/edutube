import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { reportResolveSchema } from '@/lib/validation';
import { audit, moderationDecision } from '@/lib/audit';

// PATCH /api/v1/admin/reports/:id — traiter un signalement (résoudre / classer sans suite), avec action optionnelle sur la cible
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, reportResolveSchema);
  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) throw notFound();
  if (data.action === 'HIDE_TARGET') {
    if (report.targetType === 'COMMENT') {
      const c = await prisma.comment.update({ where: { id: report.targetId }, data: { status: 'HIDDEN', hiddenReason: data.resolution ?? 'Masqué suite à signalement' } });
      const visible = await prisma.comment.count({ where: { mediaId: c.mediaId, status: 'VISIBLE' } });
      await prisma.media.update({ where: { id: c.mediaId }, data: { commentCount: visible } });
      await moderationDecision({ moderatorId: admin.id, targetType: 'COMMENT', targetId: c.id, action: 'HIDE', reason: data.resolution });
    } else {
      await prisma.media.update({ where: { id: report.targetId }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
      await moderationDecision({ moderatorId: admin.id, targetType: 'MEDIA', targetId: report.targetId, action: 'ARCHIVE', reason: data.resolution });
    }
  }
  const updated = await prisma.report.update({ where: { id: report.id }, data: { status: data.status, resolution: data.resolution ?? null, resolvedById: admin.id, resolvedAt: new Date() } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'REPORT', targetId: report.id, action: data.status, reason: data.resolution });
  await audit({ actorId: admin.id, action: 'REPORT_RESOLVE', entity: 'Report', entityId: report.id, details: { status: data.status, action: data.action } });
  return ok(updated);
});
