import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { findMediaByKey, isVisibleTo } from '@/lib/media';
import { progressSchema } from '@/lib/validation';

// POST /api/v1/media/:slug/progress — sauvegarde de la position de lecture (reprise) et progression
export const POST = handler(async (req, { params }) => {
  const user = await requireUser();
  const media = await findMediaByKey(params.slug);
  if (!media || !isVisibleTo(media, user)) throw notFound();
  const { positionSec, completed } = await parseJson(req, progressSchema);
  const duration = media.durationSec ?? 0;
  const isCompleted = completed ?? (duration > 0 && positionSec >= duration * 0.9);
  const existing = await prisma.watchHistory.findUnique({ where: { userId_mediaId: { userId: user.id, mediaId: media.id } } });
  const h = await prisma.watchHistory.upsert({
    where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
    update: { positionSec, maxPositionSec: Math.max(existing?.maxPositionSec ?? 0, positionSec), completed: (existing?.completed ?? false) || isCompleted, lastWatchedAt: new Date() },
    create: { userId: user.id, mediaId: media.id, positionSec, maxPositionSec: positionSec, completed: isCompleted },
  });
  return ok({ positionSec: h.positionSec, completed: h.completed });
});
