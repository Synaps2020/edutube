import { prisma } from '@/lib/db';
import { handler, ok, noContent, notFound, forbidden, parseJson, badRequest } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { playlistItemSchema } from '@/lib/validation';

// POST /api/v1/playlists/:id/items — ajouter un média ; DELETE ?mediaId= — retirer
export const POST = handler(async (req, { params }) => {
  const user = await requireUser();
  const pl = await prisma.playlist.findUnique({ where: { id: params.id } });
  if (!pl) throw notFound();
  if (pl.ownerId !== user.id) throw forbidden();
  const { mediaId } = await parseJson(req, playlistItemSchema);
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.status !== 'PUBLISHED') throw notFound('Contenu introuvable.');
  const max = await prisma.playlistItem.aggregate({ where: { playlistId: pl.id }, _max: { position: true } });
  await prisma.playlistItem.upsert({
    where: { playlistId_mediaId: { playlistId: pl.id, mediaId } },
    update: {},
    create: { playlistId: pl.id, mediaId, position: (max._max.position ?? 0) + 1 },
  });
  await prisma.playlist.update({ where: { id: pl.id }, data: { updatedAt: new Date() } });
  return ok({ added: true });
});

export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser();
  const pl = await prisma.playlist.findUnique({ where: { id: params.id } });
  if (!pl) throw notFound();
  if (pl.ownerId !== user.id) throw forbidden();
  const mediaId = req.nextUrl.searchParams.get('mediaId');
  if (!mediaId) throw badRequest('Paramètre mediaId requis.');
  await prisma.playlistItem.deleteMany({ where: { playlistId: pl.id, mediaId } });
  return noContent();
});
