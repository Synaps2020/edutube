import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/me/stats — statistiques individuelles (élève / enseignant)
export const GET = handler(async () => {
  const user = await requireUser();
  const [history, completed, likes, favorites, comments, playlists, subscriptions, submissions, byDiscipline, last30] = await Promise.all([
    prisma.watchHistory.count({ where: { userId: user.id } }),
    prisma.watchHistory.count({ where: { userId: user.id, completed: true } }),
    prisma.like.count({ where: { userId: user.id } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.playlist.count({ where: { ownerId: user.id } }),
    prisma.subscription.count({ where: { userId: user.id } }),
    prisma.submission.groupBy({ by: ['status'], where: { authorId: user.id }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT d.name, COUNT(*)::int AS count FROM "WatchHistory" w JOIN "Media" m ON m.id = w."mediaId" JOIN "Discipline" d ON d.id = m."disciplineId"
      WHERE w."userId" = ${user.id} GROUP BY d.name ORDER BY count DESC LIMIT 8`,
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count FROM "ViewEvent"
      WHERE "userId" = ${user.id} AND "createdAt" > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1`,
  ]);
  // Temps estimé : somme des positions maximales atteintes
  const watched = await prisma.watchHistory.aggregate({ where: { userId: user.id }, _sum: { maxPositionSec: true } });
  return ok({
    mediaStarted: history, mediaCompleted: completed, likes, favorites, comments, playlists, subscriptions,
    watchedSeconds: watched._sum.maxPositionSec ?? 0,
    submissions: Object.fromEntries(submissions.map((s) => [s.status, s._count._all])),
    byDiscipline,
    activity: last30.map((r) => ({ day: r.day, count: r.count })),
  });
});
