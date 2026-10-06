import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { rejectSchema } from '@/lib/validation';
import { audit, moderationDecision } from '@/lib/audit';
import { notify } from '@/lib/notifications';

// POST /api/v1/admin/submissions/:id/reject — rejet avec retour motivé (obligatoire)
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { reason } = await parseJson(req, rejectSchema);
  const sub = await prisma.submission.findUnique({ where: { id: params.id } });
  if (!sub) throw notFound();
  if (sub.status !== 'PENDING') throw new ApiError(409, 'Cette proposition a déjà été traitée.', 'CONFLIT');
  await prisma.submission.update({ where: { id: sub.id }, data: { status: 'REJECTED', reviewerId: admin.id, reviewNote: reason, reviewedAt: new Date() } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'SUBMISSION', targetId: sub.id, action: 'REJECT', reason });
  await audit({ actorId: admin.id, action: 'SUBMISSION_REJECT', entity: 'Submission', entityId: sub.id, details: { reason } });
  await notify({ userId: sub.authorId, type: 'SUBMISSION_REJECTED', title: `Votre proposition « ${sub.title} » n’a pas été retenue`, body: reason, link: '/mon-espace/propositions', email: true });
  return ok({ status: 'REJECTED' });
});
