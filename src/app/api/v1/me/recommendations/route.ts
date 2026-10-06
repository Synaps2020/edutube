import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { mediaCardInclude, toCard } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/me/recommendations — contenus recommandés (à moi ou à ma classe)
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await prisma.recommendation.findMany({
    where: { OR: [{ recipientId: user.id }, ...(user.classLevelId ? [{ classLevelId: user.classLevelId }] : [])], media: { status: 'PUBLISHED' } },
    include: { sender: { select: { firstName: true, lastName: true, role: true } }, classLevel: { select: { name: true } }, media: { include: mediaCardInclude } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return ok(rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.createdAt, sender: r.sender, classLevel: r.classLevel, media: toCard(r.media) })));
});
