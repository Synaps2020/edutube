import { prisma } from '@/lib/db';
import { handler, ok, notFound, noContent, forbidden } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { removeRel } from '@/lib/storage';
import { serialize } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET /api/v1/submissions/:id — détail (auteur ou admin)
export const GET = handler(async (_req, { params }) => {
  const user = await requireUser();
  const sub = await prisma.submission.findUnique({
    where: { id: params.id },
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true, establishment: true, region: true, email: true } }, cycle: true, classLevel: true, discipline: true, theme: true, reviewer: { select: { firstName: true, lastName: true } }, media: { select: { id: true, slug: true, status: true } } },
  });
  if (!sub) throw notFound();
  if (sub.authorId !== user.id && user.role !== 'ADMIN') throw forbidden();
  return ok(serialize(sub));
});

// DELETE /api/v1/submissions/:id — retrait par l'auteur tant qu'elle est en attente
export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser();
  const sub = await prisma.submission.findUnique({ where: { id: params.id } });
  if (!sub) throw notFound();
  if (sub.authorId !== user.id && user.role !== 'ADMIN') throw forbidden();
  if (sub.status !== 'PENDING' && user.role !== 'ADMIN') throw forbidden('Seule une proposition en attente peut être retirée.');
  await removeRel(sub.attachmentPath ? `submissions/${sub.id}` : null);
  await prisma.submission.delete({ where: { id: sub.id } });
  return noContent();
});
