import { prisma } from '@/lib/db';
import { handler, ok, notFound, rateLimit, ipOf } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { findMediaByKey } from '@/lib/media';

// POST /api/v1/media/:slug/view — enregistre une vue (après quelques secondes de lecture côté client)
export const POST = handler(async (req, { params }) => {
  const media = await findMediaByKey(params.slug);
  if (!media || media.status !== 'PUBLISHED') throw notFound();
  const user = await getCurrentUser();
  // Une vue par média, par session/IP et par heure
  const sessionId = req.headers.get('x-session-id') ?? ipOf(req);
  try {
    rateLimit(`view:${media.id}:${user?.id ?? sessionId}`, 1, 3600);
  } catch {
    return ok({ counted: false });
  }
  await prisma.$transaction([
    prisma.viewEvent.create({ data: { mediaId: media.id, userId: user?.id ?? null, sessionId: sessionId.slice(0, 64) } }),
    prisma.media.update({ where: { id: media.id }, data: { viewCount: { increment: 1 } } }),
  ]);
  return ok({ counted: true });
});
