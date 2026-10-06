import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { mediaCardInclude, toCard } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/me/favorites
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await prisma.favorite.findMany({ where: { userId: user.id, media: { status: 'PUBLISHED' } }, include: { media: { include: mediaCardInclude } }, orderBy: { createdAt: 'desc' } });
  return ok(rows.map((r) => ({ addedAt: r.createdAt, media: toCard(r.media) })));
});
