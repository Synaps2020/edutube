import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { mediaCardInclude, toCard } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/me/history — historique de visionnage avec progression
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await prisma.watchHistory.findMany({
    where: { userId: user.id, media: { status: 'PUBLISHED' } },
    include: { media: { include: mediaCardInclude } },
    orderBy: { lastWatchedAt: 'desc' },
    take: 100,
  });
  return ok(rows.map((r) => ({ positionSec: r.positionSec, completed: r.completed, lastWatchedAt: r.lastWatchedAt, media: toCard(r.media) })));
});
