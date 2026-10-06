import { prisma } from '@/lib/db';
import { handler, ok, notFound } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { findMediaByKey, isVisibleTo } from '@/lib/media';

async function toggle(slug: string, on: boolean) {
  const user = await requireUser();
  const media = await findMediaByKey(slug);
  if (!media || !isVisibleTo(media, user)) throw notFound();
  const key = { userId_mediaId: { userId: user.id, mediaId: media.id } };
  if (on) await prisma.favorite.upsert({ where: key, update: {}, create: { userId: user.id, mediaId: media.id } });
  else await prisma.favorite.deleteMany({ where: { userId: user.id, mediaId: media.id } });
  return ok({ favorited: on });
}

// POST /api/v1/media/:slug/favorite — ajouter aux favoris ; DELETE — retirer
export const POST = handler(async (_req, { params }) => toggle(params.slug, true));
export const DELETE = handler(async (_req, { params }) => toggle(params.slug, false));
