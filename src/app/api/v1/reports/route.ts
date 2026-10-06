import { prisma } from '@/lib/db';
import { handler, created, parseJson, rateLimit, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { reportSchema } from '@/lib/validation';
import { notifyAdmins } from '@/lib/notifications';

const REASON_LABELS: Record<string, string> = {
  CONTENU_INAPPROPRIE: 'Contenu inapproprié', ERREUR_PEDAGOGIQUE: 'Erreur pédagogique', DROITS_AUTEUR: 'Atteinte aux droits d’auteur',
  HARCELEMENT: 'Harcèlement / propos offensants', SPAM: 'Spam / publicité', AUTRE: 'Autre',
};

// POST /api/v1/reports — signaler un média ou un commentaire
export const POST = handler(async (req) => {
  const user = await requireUser();
  rateLimit(`report:${user.id}`, 10, 3600);
  const data = await parseJson(req, reportSchema);
  const exists = data.targetType === 'MEDIA'
    ? await prisma.media.findUnique({ where: { id: data.targetId }, select: { id: true, title: true } })
    : await prisma.comment.findUnique({ where: { id: data.targetId }, select: { id: true, content: true } });
  if (!exists) throw new ApiError(404, 'Cible du signalement introuvable.', 'INTROUVABLE');
  const report = await prisma.report.create({ data: { reporterId: user.id, targetType: data.targetType, targetId: data.targetId, reason: data.reason, details: data.details ?? null } });
  const label = data.targetType === 'MEDIA' ? `média « ${(exists as { title: string }).title} »` : 'un commentaire';
  await notifyAdmins({ type: 'REPORT_RECEIVED', title: `Nouveau signalement (${REASON_LABELS[data.reason]}) sur ${label}`, body: data.details ?? undefined, link: '/admin/signalements' });
  return created({ id: report.id, status: report.status });
});
