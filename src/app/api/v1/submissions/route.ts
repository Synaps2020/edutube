import path from 'path';
import { prisma } from '@/lib/db';
import { handler, created, ok, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { submissionSchema } from '@/lib/validation';
import { parseMultipart, moveUploaded, discardUploads, fieldsToObject } from '@/lib/upload';
import { ALLOWED_AUDIO_MIME, ALLOWED_VIDEO_MIME, mimeMatches } from '@/lib/storage';
import { notifyAdmins } from '@/lib/notifications';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// GET /api/v1/submissions — mes propositions
export const GET = handler(async () => {
  const user = await requireUser();
  const subs = await prisma.submission.findMany({
    where: { authorId: user.id },
    include: { classLevel: { select: { code: true, name: true } }, discipline: { select: { name: true } }, theme: { select: { name: true } }, media: { select: { slug: true, status: true } }, reviewer: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return ok(subs);
});

// POST /api/v1/submissions — proposer un contenu (enseignant ou élève), multipart/form-data
// Champs : title, description, type, cycleId, classLevelId, disciplineId, themeId, chapter?, keywords?, language?, sourceUrl?, file? (pièce jointe)
export const POST = handler(async (req) => {
  const user = await requireUser();
  if (user.role === 'ADMIN') throw new ApiError(400, 'Les administrateurs publient directement via l’espace d’administration.', 'REQUETE_INVALIDE');

  // Quota hebdomadaire
  const quota = Number((await prisma.setting.findUnique({ where: { key: 'quota.submission.maxPerWeek' } }))?.value ?? 5);
  const recent = await prisma.submission.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } });
  if (recent >= quota) throw new ApiError(429, `Quota atteint : ${quota} propositions par semaine maximum.`, 'QUOTA');

  const maxMb = Number((await prisma.setting.findUnique({ where: { key: 'quota.submission.maxMb' } }))?.value ?? env.maxSubmissionMb);
  const { fields, files } = await parseMultipart(req, { maxFileBytes: maxMb * 1024 * 1024, allowedFields: ['file'] });
  let data;
  try {
    data = submissionSchema.parse(fieldsToObject(fields));
  } catch (e) {
    await discardUploads(files);
    throw e;
  }
  const file = files.find((f) => f.field === 'file');
  if (file) {
    const allowed = data.type === 'VIDEO' ? ALLOWED_VIDEO_MIME : ALLOWED_AUDIO_MIME;
    if (!mimeMatches(file.mime, allowed)) {
      await discardUploads(files);
      throw new ApiError(415, `Format de fichier non pris en charge pour un contenu ${data.type === 'VIDEO' ? 'vidéo' : 'audio'}.`, 'FORMAT_NON_SUPPORTE');
    }
  }
  if (!file && !data.sourceUrl) {
    throw new ApiError(422, 'Joignez un fichier ou indiquez un lien vers votre contenu.', 'VALIDATION');
  }
  const cl = await prisma.classLevel.findUnique({ where: { id: data.classLevelId } });
  if (!cl || cl.cycleId !== data.cycleId) {
    await discardUploads(files);
    throw new ApiError(422, 'La classe ne correspond pas au cycle choisi.', 'VALIDATION');
  }

  const submission = await prisma.submission.create({
    data: {
      type: data.type, title: data.title, description: data.description, cycleId: data.cycleId, classLevelId: data.classLevelId,
      disciplineId: data.disciplineId, themeId: data.themeId, chapter: data.chapter ?? null, keywords: data.keywords ?? [], language: data.language,
      sourceUrl: data.sourceUrl || null, authorId: user.id,
    },
  });
  if (file) {
    const rel = await moveUploaded(file, path.join('submissions', submission.id));
    await prisma.submission.update({ where: { id: submission.id }, data: { attachmentPath: rel, attachmentName: file.name, attachmentSize: BigInt(file.size) } });
  }
  await notifyAdmins({ type: 'SUBMISSION_RECEIVED', title: `Nouvelle proposition : « ${data.title} »`, body: `Proposée par ${user.firstName} ${user.lastName} (${user.role === 'TEACHER' ? 'enseignant' : 'élève'}${user.establishment ? ', ' + user.establishment : ''}).`, link: `/admin/moderation` });
  await audit({ actorId: user.id, action: 'SUBMISSION_CREATE', entity: 'Submission', entityId: submission.id });
  return created({ id: submission.id, status: submission.status });
});
