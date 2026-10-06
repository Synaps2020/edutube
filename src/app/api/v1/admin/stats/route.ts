import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/stats — tableau de bord d'audience et d'activité
export const GET = handler(async () => {
  await requireRole('ADMIN');
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [usersByRole, mediaByStatus, mediaByType, views30, viewsTotal, newUsers30, pendingSubmissions, openReports, jobs, topMedia, viewsPerDay, byDiscipline, byCycle, byRegion, comments30, likesTotal, senprofMediaCount, demoMediaCount] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.media.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.media.groupBy({ by: ['type'], where: { status: 'PUBLISHED' }, _count: { _all: true } }),
    prisma.viewEvent.count({ where: { createdAt: { gte: since30 } } }),
    prisma.viewEvent.count(),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.submission.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.media.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, slug: true, title: true, type: true, viewCount: true, likeCount: true, commentCount: true }, orderBy: { viewCount: 'desc' }, take: 10 }),
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count FROM "ViewEvent" WHERE "createdAt" > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ name: string; color: string; count: number }>>`SELECT d.name, d.color, COUNT(v.id)::int AS count FROM "ViewEvent" v JOIN "Media" m ON m.id = v."mediaId" JOIN "Discipline" d ON d.id = m."disciplineId" GROUP BY d.name, d.color ORDER BY count DESC LIMIT 12`,
    prisma.$queryRaw<Array<{ name: string; count: number }>>`SELECT c.name, COUNT(v.id)::int AS count FROM "ViewEvent" v JOIN "Media" m ON m.id = v."mediaId" JOIN "Cycle" c ON c.id = m."cycleId" GROUP BY c.name, c."order" ORDER BY c."order"`,
    prisma.$queryRaw<Array<{ region: string; count: number }>>`SELECT COALESCE(region, 'Non renseignée') AS region, COUNT(*)::int AS count FROM "User" GROUP BY 1 ORDER BY count DESC LIMIT 14`,
    prisma.comment.count({ where: { createdAt: { gte: since30 } } }),
    prisma.like.count(),
    prisma.media.count({ where: { channel: { slug: 'senprof' } } }),
    prisma.media.count({ where: { isDemo: true } }),
  ]);
  const storage = await prisma.media.aggregate({ _sum: { originalSize: true } });
  return ok({
    users: Object.fromEntries(usersByRole.map((u) => [u.role, u._count._all])),
    media: Object.fromEntries(mediaByStatus.map((m) => [m.status, m._count._all])),
    mediaByType: Object.fromEntries(mediaByType.map((m) => [m.type, m._count._all])),
    views30, viewsTotal, newUsers30, pendingSubmissions, openReports, comments30, likesTotal,
    jobs: Object.fromEntries(jobs.map((j) => [j.status, j._count._all])),
    storageBytes: Number(storage._sum.originalSize ?? 0), senprofMediaCount, demoMediaCount,
    topMedia, viewsPerDay, byDiscipline, byCycle, byRegion,
  });
});
