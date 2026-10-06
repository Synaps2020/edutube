import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';

// POST /api/v1/me/notifications/read-all
export const POST = handler(async () => {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return ok({ read: true });
});
