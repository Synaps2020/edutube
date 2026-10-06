import path from 'path';
import { prisma } from '@/lib/db';
import { handler, ok, created, parseQuery, ApiError, serialize } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { mediaMetadataSchema, catalogQuerySchema } from '@/lib/validation';
import { parseMultipart, moveUploaded, discardUploads, fieldsToObject } from '@/lib/upload';
import { ALLOWED_AUDIO_MIME, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME, mimeMatches } from '@/lib/storage';
import { listMedia } from '@/lib/media';
import { slugify, shortCode, randomSuffix } from '@/lib/utils';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const adminQuerySchema = catalogQuerySchema.extend({
  statut: z.enum(['DRAFT', 'PENDING', 'PROCESSING', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'FAILED']).optional(),
});

// GET /api/v1/admin/media — tous les contenus (tous statuts), filtrables
export const GET = handler(async (req) => {
  await requireRole('ADMIN');
  const q = parseQuery(req, adminQuerySchema);
  const statuses = q.statut ? [q.statut] : (['DRAFT', 'PENDING', 'PROCESSING', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'FAILED'] as const);
  const result = await listMedia({ ...q, tri: q.q ? 'pertinence' : q.tri }, { statuses: [...statuses] });
  // Jobs en cours pour affichage de la progression
  const ids = result.items.map((i) => i.id);
  const jobs = await prisma.job.findMany({ where: { mediaId: { in: ids }, status: { in: ['QUEUED', 'RUNNING', 'FAILED'] } }, orderBy: { createdAt: 'desc' } });
  const jobByMedia = Object.fromEntries(jobs.map((j) => [j.mediaId, { id: j.id, status: j.status, progress: j.progress, error: j.error, attempts: j.attempts }]));
  return ok({ ...result, items: result.items.map((i) => ({ ...i, job: jobByMedia[i.id] ?? null })) });
});

// POST /api/v1/admin/media — téléversement administrateur (multipart/form-data)
// Champs : voir mediaMetadataSchema + file (vidéo/audio, obligatoire) + thumbnail (image, optionnelle) + subtitles (.vtt, optionnel)
export const POST = handler(async (req) => {
  const admin = await requireRole('ADMIN');
  const { fields, files } = await parseMultipart(req, { maxFileBytes: env.maxUploadMb * 1024 * 1024, allowedFields: ['file', 'thumbnail', 'subtitles'] });
  let data;
  try {
    data = mediaMetadataSchema.parse(fieldsToObject(fields));
  } catch (e) {
    await discardUploads(files);
    throw e;
  }
  const file = files.find((f) => f.field === 'file');
  const thumb = files.find((f) => f.field === 'thumbnail');
  const subs = files.find((f) => f.field === 'subtitles');
  const fail = async (status: number, msg: string, code: string) => {
    await discardUploads(files);
    throw new ApiError(status, msg, code);
  };
  if (!file) await fail(422, 'Le fichier média est obligatoire.', 'VALIDATION');
  if (!mimeMatches(file!.mime, data.type === 'VIDEO' ? ALLOWED_VIDEO_MIME : ALLOWED_AUDIO_MIME)) await fail(415, 'Format de fichier média non pris en charge.', 'FORMAT_NON_SUPPORTE');
  if (thumb && !mimeMatches(thumb.mime, ALLOWED_IMAGE_MIME)) await fail(415, 'La miniature doit être une image JPEG, PNG ou WebP.', 'FORMAT_NON_SUPPORTE');
  const [cl, channel] = await Promise.all([prisma.classLevel.findUnique({ where: { id: data.classLevelId } }), prisma.channel.findUnique({ where: { id: data.channelId } })]);
  if (!cl || cl.cycleId !== data.cycleId) await fail(422, 'La classe ne correspond pas au cycle choisi.', 'VALIDATION');
  if (!channel) await fail(422, 'Chaîne inconnue.', 'VALIDATION');

  let slug = slugify(data.title);
  if (await prisma.media.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix(4)}`;

  const media = await prisma.media.create({
    data: {
      slug, shortCode: shortCode(), type: data.type, status: 'PROCESSING', title: data.title, description: data.description,
      cycleId: data.cycleId, classLevelId: data.classLevelId, disciplineId: data.disciplineId, themeId: data.themeId, chapter: data.chapter,
      keywords: data.keywords, language: data.language, license: data.license, pedagogicalAuthor: data.pedagogicalAuthor, difficulty: data.difficulty,
      uploaderId: admin.id, channelId: data.channelId, downloadable: data.downloadable, transcript: data.transcript || null,
      originalName: file!.name, originalSize: BigInt(file!.size),
    },
  });
  const originalRel = await moveUploaded(file!, path.join('originals', media.id), `source${path.extname(file!.name) || ''}`);
  const thumbRel = thumb ? await moveUploaded(thumb, 'thumbs', `${media.id}${path.extname(thumb.name) || '.jpg'}`) : null;
  const subsRel = subs ? await moveUploaded(subs, 'subtitles', `${media.id}.vtt`) : null;
  await prisma.media.update({ where: { id: media.id }, data: { originalPath: originalRel, thumbnailPath: thumbRel, subtitlesPath: subsRel } });
  const job = await prisma.job.create({ data: { type: data.type === 'VIDEO' ? 'TRANSCODE_VIDEO' : 'PROCESS_AUDIO', mediaId: media.id, payload: { publishWhenDone: data.publishImmediately } } });
  await audit({ actorId: admin.id, action: 'MEDIA_CREATE', entity: 'Media', entityId: media.id, details: { title: data.title, type: data.type, size: file!.size } });
  return created(serialize({ id: media.id, slug: media.slug, status: media.status, jobId: job.id }));
});
