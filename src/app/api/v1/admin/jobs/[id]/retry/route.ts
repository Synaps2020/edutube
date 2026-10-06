import { prisma } from '@/lib/db';
import { handler, ok, notFound } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';

// POST /api/v1/admin/jobs/:id/retry — relancer un job en échec
export const POST = handler(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) throw notFound();
  await prisma.job.update({ where: { id: job.id }, data: { status: 'QUEUED', attempts: 0, error: null, progress: 0, lockedBy: null, lockedAt: null, finishedAt: null } });
  await prisma.media.update({ where: { id: job.mediaId }, data: { status: 'PROCESSING', processingError: null } });
  await audit({ actorId: admin.id, action: 'JOB_RETRY', entity: 'Job', entityId: job.id });
  return ok({ status: 'QUEUED' });
});
