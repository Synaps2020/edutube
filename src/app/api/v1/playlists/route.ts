import { prisma } from '@/lib/db';
import { handler, ok, created, parseJson } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { playlistSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// GET /api/v1/playlists — mes listes de lecture
export const GET = handler(async () => {
  const user = await requireUser();
  const playlists = await prisma.playlist.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { items: true } }, items: { take: 1, orderBy: { position: 'asc' }, include: { media: { select: { thumbnailPath: true } } } } },
    orderBy: { updatedAt: 'desc' },
  });
  return ok(playlists);
});

// POST /api/v1/playlists — créer une liste
export const POST = handler(async (req) => {
  const user = await requireUser();
  const data = await parseJson(req, playlistSchema);
  const pl = await prisma.playlist.create({ data: { ...data, description: data.description ?? null, ownerId: user.id } });
  return created(pl);
});
