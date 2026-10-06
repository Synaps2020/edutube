import { prisma } from '@/lib/db';
import { handler, ok, parseQuery } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/comments?statut=PENDING|HIDDEN|VISIBLE — modération des commentaires
export const GET = handler(async (req) => {
  await requireRole('ADMIN');
  const { statut } = parseQuery(req, z.object({ statut: z.enum(['VISIBLE', 'HIDDEN', 'PENDING']).optional() }));
  const comments = await prisma.comment.findMany({
    where: statut ? { status: statut } : {},
    include: { author: { select: { firstName: true, lastName: true, role: true } }, media: { select: { slug: true, title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(comments);
});
