import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson, ApiError, forbidden } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { findMediaByKey } from '@/lib/media';
import { recommendSchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';

// POST /api/v1/media/:slug/recommend — recommandation privée à un utilisateur ou diffusion à une classe
export const POST = handler(async (req, { params }) => {
  const user = await requireUser();
  const media = await findMediaByKey(params.slug);
  if (!media || media.status !== 'PUBLISHED') throw notFound();
  const data = await parseJson(req, recommendSchema);
  const sender = `${user.firstName} ${user.lastName}`;
  const link = `/media/${media.slug}`;

  if (data.classLevelId) {
    // Diffusion à une classe : réservée aux enseignants et administrateurs, ou à un élève vers sa propre classe
    if (user.role === 'STUDENT' && user.classLevelId !== data.classLevelId) throw forbidden('Vous ne pouvez diffuser qu’à votre propre classe.');
    const cl = await prisma.classLevel.findUnique({ where: { id: data.classLevelId } });
    if (!cl) throw new ApiError(422, 'Classe inconnue.', 'VALIDATION');
    const recipients = await prisma.user.findMany({ where: { classLevelId: cl.id, status: 'ACTIVE', id: { not: user.id } }, select: { id: true } });
    await prisma.recommendation.create({ data: { senderId: user.id, classLevelId: cl.id, mediaId: media.id, message: data.message ?? null } });
    if (recipients.length) {
      await prisma.notification.createMany({ data: recipients.map((r) => ({ userId: r.id, type: 'RECOMMENDATION' as const, title: `${sender} recommande « ${media.title} » à la classe de ${cl.name}`, body: data.message ?? undefined, link })) });
    }
    return ok({ delivered: recipients.length, scope: 'class' });
  }

  let recipientId = data.recipientId ?? null;
  if (!recipientId && data.recipientEmail) {
    const r = await prisma.user.findUnique({ where: { email: data.recipientEmail }, select: { id: true } });
    if (!r) throw new ApiError(404, 'Aucun utilisateur avec cette adresse e-mail.', 'INTROUVABLE');
    recipientId = r.id;
  }
  if (!recipientId || recipientId === user.id) throw new ApiError(422, 'Destinataire invalide.', 'VALIDATION');
  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.status !== 'ACTIVE') throw new ApiError(404, 'Destinataire introuvable.', 'INTROUVABLE');
  await prisma.recommendation.create({ data: { senderId: user.id, recipientId, mediaId: media.id, message: data.message ?? null } });
  await notify({ userId: recipientId, type: 'RECOMMENDATION', title: `${sender} vous recommande « ${media.title} »`, body: data.message ?? undefined, link, email: true });
  return ok({ delivered: 1, scope: 'user' });
});
