import { prisma } from '@/lib/db';
import { handler, ok, parseQuery } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/audit?q=&page= — journal d'audit + décisions de modération
export const GET = handler(async (req) => {
  await requireRole('ADMIN');
  const { q, page, pageSize, type } = parseQuery(req, z.object({ q: z.string().optional(), type: z.enum(['audit', 'moderation']).default('audit'), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(50) }));
  if (type === 'moderation') {
    const [total, items] = await Promise.all([
      prisma.moderationDecision.count(),
      prisma.moderationDecision.findMany({ include: { moderator: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return ok({ items, meta: { page, pageSize, total } });
  }
  const where = q ? { OR: [{ action: { contains: q.toUpperCase() } }, { entity: { contains: q, mode: 'insensitive' as const } }, { entityId: q }] } : {};
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { actor: { select: { firstName: true, lastName: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return ok({ items, meta: { page, pageSize, total } });
});
