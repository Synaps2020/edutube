import path from 'path';
import fsp from 'fs/promises';
import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { submissionReviewSchema } from '@/lib/validation';
import { abs, ensureDir } from '@/lib/storage';
import { slugify, shortCode, randomSuffix } from '@/lib/utils';
import { audit, moderationDecision } from '@/lib/audit';
import { notify } from '@/lib/notifications';

// POST /api/v1/admin/submissions/:id/approve
// Approuve une proposition : si un fichier est joint, un Media est créé (contributeur = auteur) et
// envoyé au transcodage, puis publié automatiquement. Sans fichier, l'administrateur devra
// téléverser le média lui-même : la proposition est marquée approuvée et liée ultérieurement.
// L'administrateur peut compléter les métadonnées obligatoires via `overrides`.
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { note, overrides } = await parseJson(req, submissionReviewSchema);
  const sub = await prisma.submission.findUnique({ where: { id: params.id }, include: { author: true } });
  if (!sub) throw notFound();
  if (sub.status !== 'PENDING') throw new ApiError(409, 'Cette proposition a déjà été traitée.', 'CONFLIT');

  let mediaId: string | null = null;
  if (sub.attachmentPath) {
    const channel = overrides?.channelId
      ? await prisma.channel.findUnique({ where: { id: overrides.channelId } })
      : await prisma.channel.findFirst({ where: { isOfficial: true }, orderBy: { createdAt: 'asc' } });
    if (!channel) throw new ApiError(422, 'Aucune chaîne de publication disponible.', 'VALIDATION');
    let slug = slugify(overrides?.title ?? sub.title);
    if (await prisma.media.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix(4)}`;
    const media = await prisma.media.create({
      data: {
        slug, shortCode: shortCode(), type: sub.type, status: 'PROCESSING',
        title: overrides?.title ?? sub.title, description: overrides?.description ?? sub.description,
        cycleId: overrides?.cycleId ?? sub.cycleId, classLevelId: overrides?.classLevelId ?? sub.classLevelId,
        disciplineId: overrides?.disciplineId ?? sub.disciplineId, themeId: overrides?.themeId ?? sub.themeId,
        chapter: overrides?.chapter ?? sub.chapter ?? 'Non précisé', keywords: overrides?.keywords ?? sub.keywords,
        language: overrides?.language ?? sub.language, license: overrides?.license ?? 'CC BY-NC-SA 4.0',
        pedagogicalAuthor: overrides?.pedagogicalAuthor ?? `${sub.author.firstName} ${sub.author.lastName}${sub.author.establishment ? ' — ' + sub.author.establishment : ''}`,
        difficulty: overrides?.difficulty ?? 'INTERMEDIAIRE', downloadable: overrides?.downloadable ?? false,
        uploaderId: admin.id, contributorId: sub.authorId, channelId: channel.id,
        originalName: sub.attachmentName, originalSize: sub.attachmentSize,
      },
    });
    // Déplacement de la pièce jointe vers les originaux
    const destDir = path.join('originals', media.id);
    await ensureDir(destDir);
    const destRel = path.join(destDir, `source${path.extname(sub.attachmentName ?? '') || ''}`);
    await fsp.rename(abs(sub.attachmentPath), abs(destRel)).catch(async () => { await fsp.copyFile(abs(sub.attachmentPath!), abs(destRel)); });
    await prisma.media.update({ where: { id: media.id }, data: { originalPath: destRel } });
    await prisma.job.create({ data: { type: sub.type === 'VIDEO' ? 'TRANSCODE_VIDEO' : 'PROCESS_AUDIO', mediaId: media.id, payload: { publishWhenDone: true } } });
    mediaId = media.id;
  }

  await prisma.submission.update({ where: { id: sub.id }, data: { status: 'APPROVED', reviewerId: admin.id, reviewNote: note ?? null, reviewedAt: new Date(), mediaId } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'SUBMISSION', targetId: sub.id, action: 'APPROVE', reason: note });
  await audit({ actorId: admin.id, action: 'SUBMISSION_APPROVE', entity: 'Submission', entityId: sub.id, details: { mediaId } });
  await notify({
    userId: sub.authorId, type: 'SUBMISSION_APPROVED',
    title: `Votre proposition « ${sub.title} » a été approuvée`,
    body: mediaId ? `${note ? note + ' ' : ''}Le contenu est en cours de traitement et sera publié automatiquement.` : `${note ? note + ' ' : ''}La cellule pédagogique va finaliser la mise en ligne.`,
    link: '/mon-espace/propositions', email: true,
  });
  return ok({ status: 'APPROVED', mediaId });
});
