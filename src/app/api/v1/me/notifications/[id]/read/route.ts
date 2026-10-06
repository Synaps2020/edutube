import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';

// POST /api/v1/me/notifications/:id/read
export const POST = handler(async (_req, { params }) => {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { id: params.id, userId: user.id }, data: { readAt: new Date() } });
  return ok({ read: true });
});
