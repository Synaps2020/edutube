import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/jobs — file de traitement (100 derniers)
export const GET = handler(async () => {
  await requireRole('ADMIN');
  const jobs = await prisma.job.findMany({ include: { media: { select: { id: true, title: true, type: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return ok(jobs);
});
