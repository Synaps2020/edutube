import { prisma } from '@/lib/db';
import { handler, ok, noContent, notFound, forbidden, parseJson } from '@/lib/api';
import { getCurrentUser, requireUser } from '@/lib/auth';
import { playlistSchema } from '@/lib/validation';
import { mediaCardInclude, toCard } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/playlists/:id — liste (publique ou propriétaire/admin)
export const GET = handler(async (_req, { params }) => {
  const user = await getCurrentUser();
  const pl = await prisma.playlist.findUnique({
    where: { id: params.id },
    include: { owner: { select: { id: true, firstName: true, lastName: true, role: true } }, items: { orderBy: { position: 'asc' }, include: { media: { include: mediaCardInclude } } } },
  });
  if (!pl) throw notFound('Liste introuvable.');
  const isOwner = user && (user.id === pl.ownerId || user.role === 'ADMIN');
  if (!pl.isPublic && !isOwner) throw notFound('Liste introuvable.');
  const items = pl.items.filter((i) => i.media.status === 'PUBLISHED' || isOwner).map((i) => ({ position: i.position, addedAt: i.addedAt, media: toCard(i.media) }));
  return ok({ ...pl, items, isOwner: !!isOwner });
});

// PATCH /api/v1/playlists/:id — modifier
export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser();
  const pl = await prisma.playlist.findUnique({ where: { id: params.id } });
  if (!pl) throw notFound();
  if (pl.ownerId !== user.id && user.role !== 'ADMIN') throw forbidden();
  const data = await parseJson(req, playlistSchema.partial());
  return ok(await prisma.playlist.update({ where: { id: pl.id }, data }));
});

// DELETE /api/v1/playlists/:id
export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser();
  const pl = await prisma.playlist.findUnique({ where: { id: params.id } });
  if (!pl) throw notFound();
  if (pl.ownerId !== user.id && user.role !== 'ADMIN') throw forbidden();
  await prisma.playlist.delete({ where: { id: pl.id } });
  return noContent();
});
