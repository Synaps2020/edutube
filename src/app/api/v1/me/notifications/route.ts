import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/me/notifications
export const GET = handler(async () => {
  const user = await requireUser();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return ok({ items, unread });
});
