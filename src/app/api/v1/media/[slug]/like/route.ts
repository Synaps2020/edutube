import { prisma } from '@/lib/db';
import { handler, ok, notFound } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { findMediaByKey, isVisibleTo } from '@/lib/media';

async function toggle(slug: string, on: boolean) {
  const user = await requireUser();
  const media = await findMediaByKey(slug);
  if (!media || !isVisibleTo(media, user)) throw notFound();
  const key = { userId_mediaId: { userId: user.id, mediaId: media.id } };
  const existing = await prisma.like.findUnique({ where: key });
  if (on && !existing) {
    await prisma.$transaction([prisma.like.create({ data: { userId: user.id, mediaId: media.id } }), prisma.media.update({ where: { id: media.id }, data: { likeCount: { increment: 1 } } })]);
  } else if (!on && existing) {
    await prisma.$transaction([prisma.like.delete({ where: key }), prisma.media.update({ where: { id: media.id }, data: { likeCount: { decrement: 1 } } })]);
  }
  const m = await prisma.media.findUniqueOrThrow({ where: { id: media.id }, select: { likeCount: true } });
  return ok({ liked: on, likeCount: m.likeCount });
}

// POST /api/v1/media/:slug/like — aimer ; DELETE — retirer
export const POST = handler(async (_req, { params }) => toggle(params.slug, true));
export const DELETE = handler(async (_req, { params }) => toggle(params.slug, false));
