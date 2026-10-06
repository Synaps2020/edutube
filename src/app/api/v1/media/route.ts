import { prisma } from '@/lib/db';
import { handler, ok, notFound } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { findMediaByKey, isVisibleTo, toDetail, viewerFlags, mediaCardInclude, toCard } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/media/:slug — détail d'un média (slug, id ou code court) + état pour le visiteur
export const GET = handler(async (_req, { params }) => {
  const media = await findMediaByKey(params.slug);
  const user = await getCurrentUser();
  if (!media || !isVisibleTo(media, user)) throw notFound('Contenu introuvable ou non publié.');
  const [flags, related, subscribed] = await Promise.all([
    viewerFlags(media.id, user?.id ?? null),
    prisma.media.findMany({
      where: { status: 'PUBLISHED', id: { not: media.id }, OR: [{ disciplineId: media.disciplineId, classLevelId: media.classLevelId }, { themeId: media.themeId, cycleId: media.cycleId }] },
      include: mediaCardInclude,
      orderBy: [{ viewCount: 'desc' }],
      take: 8,
    }),
    user ? prisma.subscription.findUnique({ where: { userId_channelId: { userId: user.id, channelId: media.channelId } } }) : null,
  ]);
  return ok({ media: toDetail(media), viewer: { ...flags, subscribed: !!subscribed }, related: related.map(toCard) });
});
