import 'server-only';
import { prisma } from './db';
import { ApiError } from './api';
import { slugify, shortCode, randomSuffix } from './utils';
import { parseYouTubeVideoId, fetchYoutubeOEmbed, fetchYoutubeChannelFeed } from './youtube';
import type { z } from 'zod';
import type { youtubeMediaSchema, youtubeImportSchema } from './validation';

type Meta = z.infer<typeof youtubeMediaSchema>;
type ImportBody = z.infer<typeof youtubeImportSchema>;

async function uniqueSlug(title: string) {
  let slug = slugify(title);
  if (await prisma.media.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix(4)}`;
  return slug;
}

async function assertTaxonomy(data: { cycleId: string; classLevelId: string; disciplineId: string; themeId: string; channelId: string }) {
  const [cl, channel, discipline, theme] = await Promise.all([
    prisma.classLevel.findUnique({ where: { id: data.classLevelId } }),
    prisma.channel.findUnique({ where: { id: data.channelId } }),
    prisma.discipline.findUnique({ where: { id: data.disciplineId } }),
    prisma.theme.findUnique({ where: { id: data.themeId } }),
  ]);
  if (!cl || cl.cycleId !== data.cycleId) throw new ApiError(422, 'La classe ne correspond pas au cycle choisi.', 'VALIDATION');
  if (!channel) throw new ApiError(422, 'Chaîne inconnue.', 'VALIDATION');
  if (!discipline) throw new ApiError(422, 'Discipline inconnue.', 'VALIDATION');
  if (!theme) throw new ApiError(422, 'Thématique inconnue.', 'VALIDATION');
}

export async function createYoutubeMedia(adminId: string, data: Meta) {
  const videoId = parseYouTubeVideoId(data.youtubeUrl);
  if (!videoId) throw new ApiError(422, 'Lien YouTube invalide. Collez une URL watch, youtu.be ou shorts.', 'VALIDATION');
  const dup = await prisma.media.findUnique({ where: { youtubeVideoId: videoId } });
  if (dup) throw new ApiError(409, 'Cette vidéo YouTube est déjà intégrée au catalogue.', 'CONFLIT');
  await assertTaxonomy(data);
  const oembed = await fetchYoutubeOEmbed(videoId);
  const title = data.title.trim() || oembed?.title || `Vidéo ${videoId}`;
  const description = data.description.trim() || oembed?.title || 'Vidéo officielle du Ministère de l’Éducation nationale (SIMEN).';
  const publish = data.publishImmediately;
  return prisma.media.create({
    data: {
      slug: await uniqueSlug(title),
      shortCode: shortCode(),
      type: 'VIDEO',
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
      title,
      description,
      cycleId: data.cycleId,
      classLevelId: data.classLevelId,
      disciplineId: data.disciplineId,
      themeId: data.themeId,
      chapter: data.chapter,
      keywords: data.keywords.length ? data.keywords : ['SIMEN', 'MEN'],
      language: data.language,
      license: data.license || 'Tous droits réservés — MEN',
      pedagogicalAuthor: data.pedagogicalAuthor?.trim() || oembed?.authorName || 'SIMEN — Ministère de l’Éducation nationale',
      difficulty: data.difficulty,
      uploaderId: adminId,
      channelId: data.channelId,
      downloadable: false,
      transcript: data.transcript || null,
      youtubeVideoId: videoId,
    },
  });
}

export async function importYoutubeVideos(adminId: string, body: ImportBody) {
  await assertTaxonomy(body);
  const ids: string[] = [];
  if (body.fromOfficialChannel) {
    const handle = process.env.YOUTUBE_CHANNEL_HANDLE ?? 'simen3978';
    const feed = await fetchYoutubeChannelFeed(process.env.YOUTUBE_CHANNEL_ID || handle);
    ids.push(...feed.map((v) => v.id));
  }
  for (const raw of body.urls ?? []) {
    const id = parseYouTubeVideoId(raw);
    if (id) ids.push(id);
  }
  const unique = [...new Set(ids)];
  if (!unique.length) throw new ApiError(422, 'Aucune vidéo YouTube à importer. Vérifiez les liens ou la chaîne officielle.', 'VALIDATION');

  const created: Array<{ id: string; title: string; youtubeVideoId: string }> = [];
  const skipped: Array<{ youtubeVideoId: string; reason: string }> = [];

  for (const videoId of unique) {
    const exists = await prisma.media.findUnique({ where: { youtubeVideoId: videoId } });
    if (exists) {
      skipped.push({ youtubeVideoId: videoId, reason: 'Déjà dans le catalogue' });
      continue;
    }
    const oembed = await fetchYoutubeOEmbed(videoId);
    const title = oembed?.title || `Vidéo SIMEN ${videoId}`;
    const media = await prisma.media.create({
      data: {
        slug: await uniqueSlug(title),
        shortCode: shortCode(),
        type: 'VIDEO',
        status: body.publishImmediately ? 'PUBLISHED' : 'DRAFT',
        publishedAt: body.publishImmediately ? new Date() : null,
        title,
        description: (oembed?.title ? `${oembed.title}\n\n` : '') + 'Vidéo officielle de la chaîne YouTube SIMEN (Ministère de l’Éducation nationale).',
        cycleId: body.cycleId,
        classLevelId: body.classLevelId,
        disciplineId: body.disciplineId,
        themeId: body.themeId,
        chapter: body.chapter || 'Chaîne officielle SIMEN',
        keywords: body.keywords.length ? body.keywords : ['SIMEN', 'MEN', 'YouTube'],
        language: body.language,
        license: body.license || 'Tous droits réservés — MEN',
        pedagogicalAuthor: body.pedagogicalAuthor?.trim() || oembed?.authorName || 'SIMEN — Ministère de l’Éducation nationale',
        difficulty: body.difficulty,
        uploaderId: adminId,
        channelId: body.channelId,
        downloadable: false,
        youtubeVideoId: videoId,
      },
    });
    created.push({ id: media.id, title: media.title, youtubeVideoId: videoId });
  }

  return { created, skipped, total: unique.length };
}
