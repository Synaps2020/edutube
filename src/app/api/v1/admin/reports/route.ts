import { prisma } from '@/lib/db';
import { handler, ok, parseQuery } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/reports?statut=OPEN — signalements avec aperçu de la cible
export const GET = handler(async (req) => {
  await requireRole('ADMIN');
  const { statut } = parseQuery(req, z.object({ statut: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).optional() }));
  const reports = await prisma.report.findMany({
    where: statut ? { status: statut } : {},
    include: { reporter: { select: { firstName: true, lastName: true, role: true } }, resolvedBy: { select: { firstName: true, lastName: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const mediaIds = reports.filter((r) => r.targetType === 'MEDIA').map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === 'COMMENT').map((r) => r.targetId);
  const [medias, comments] = await Promise.all([
    prisma.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true, title: true, slug: true, status: true } }),
    prisma.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, content: true, status: true, author: { select: { firstName: true, lastName: true } }, media: { select: { slug: true, title: true } } } }),
  ]);
  const m = Object.fromEntries(medias.map((x) => [x.id, x]));
  const c = Object.fromEntries(comments.map((x) => [x.id, x]));
  return ok(reports.map((r) => ({ ...r, target: r.targetType === 'MEDIA' ? m[r.targetId] ?? null : c[r.targetId] ?? null })));
});
