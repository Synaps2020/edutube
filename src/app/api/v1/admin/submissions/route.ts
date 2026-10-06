import { prisma } from '@/lib/db';
import { handler, ok, parseQuery, serialize } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/submissions?statut=PENDING — file de validation des propositions
export const GET = handler(async (req) => {
  await requireRole('ADMIN');
  const { statut, page, pageSize } = parseQuery(req, z.object({ statut: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) }));
  const where = statut ? { status: statut } : {};
  const [total, items] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true, establishment: true, region: true } }, classLevel: { select: { code: true, name: true } }, discipline: { select: { name: true } }, theme: { select: { name: true } }, reviewer: { select: { firstName: true, lastName: true } }, media: { select: { id: true, slug: true, status: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return ok(serialize({ items, meta: { page, pageSize, total } }));
});
