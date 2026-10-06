import 'server-only';
import { Prisma, type Media, type MediaStatus } from '@prisma/client';
import { prisma } from './db';
import { publicUrl } from './storage';
import type { CatalogQuery } from './validation';
import { paginationMeta } from './api';

// Sélection standard pour les cartes du catalogue
export const mediaCardInclude = {
  cycle: { select: { id: true, code: true, name: true } },
  classLevel: { select: { id: true, code: true, name: true } },
  discipline: { select: { id: true, code: true, name: true, color: true } },
  theme: { select: { id: true, code: true, name: true } },
  channel: { select: { id: true, slug: true, name: true, isOfficial: true } },
} satisfies Prisma.MediaInclude;

export type MediaWithRefs = Prisma.MediaGetPayload<{ include: typeof mediaCardInclude }>;

export interface MediaCardDTO {
  id: string;
  slug: string;
  shortCode: string;
  type: 'VIDEO' | 'AUDIO';
  status: MediaStatus;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  language: string;
  difficulty: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
  createdAt: string;
  cycle: { id: string; code: string; name: string };
  classLevel: { id: string; code: string; name: string };
  discipline: { id: string; code: string; name: string; color: string };
  theme: { id: string; code: string; name: string };
  channel: { id: string; slug: string; name: string; isOfficial: boolean };
  chapter: string;
  keywords: string[];
  pedagogicalAuthor: string;
  license: string;
  downloadable: boolean;
}

export function toCard(m: MediaWithRefs): MediaCardDTO {
  return {
    id: m.id,
    slug: m.slug,
    shortCode: m.shortCode,
    type: m.type,
    status: m.status,
    title: m.title,
    description: m.description,
    thumbnailUrl: publicUrl(m.thumbnailPath),
    durationSec: m.durationSec,
    language: m.language,
    difficulty: m.difficulty,
    viewCount: m.viewCount,
    likeCount: m.likeCount,
    commentCount: m.commentCount,
    publishedAt: m.publishedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    cycle: m.cycle,
    classLevel: m.classLevel,
    discipline: m.discipline,
    theme: m.theme,
    channel: m.channel,
    chapter: m.chapter,
    keywords: m.keywords,
    pedagogicalAuthor: m.pedagogicalAuthor,
    license: m.license,
    downloadable: m.downloadable,
  };
}

export interface MediaDetailDTO extends MediaCardDTO {
  hlsUrl: string | null;
  audioUrl: string | null;
  waveformUrl: string | null;
  subtitlesUrl: string | null;
  transcript: string | null;
  renditions: Array<{ height: number; bandwidth: number; path: string }> | null;
  width: number | null;
  height: number | null;
  rejectionReason: string | null;
  processingError: string | null;
  uploader: { id: string; firstName: string; lastName: string } | null;
  contributor: { id: string; firstName: string; lastName: string; role: string } | null;
}

export function toDetail(
  m: MediaWithRefs & {
    uploader?: { id: string; firstName: string; lastName: string } | null;
    contributor?: { id: string; firstName: string; lastName: string; role: string } | null;
  },
): MediaDetailDTO {
  return {
    ...toCard(m),
    hlsUrl: publicUrl(m.hlsMasterPath),
    audioUrl: publicUrl(m.audioPath),
    waveformUrl: publicUrl(m.waveformPath),
    subtitlesUrl: publicUrl(m.subtitlesPath),
    transcript: m.transcript,
    renditions: (m.renditions as MediaDetailDTO['renditions']) ?? null,
    width: m.width,
    height: m.height,
    rejectionReason: m.rejectionReason,
    processingError: m.processingError,
    uploader: m.uploader ?? null,
    contributor: m.contributor ?? null,
  };
}

// ---------------------------------------------------------------------------
// Recherche plein texte (PostgreSQL, dictionnaire français) — renvoie les ids classés.
// ---------------------------------------------------------------------------
async function searchIds(q: string, onlyPublished: boolean): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Media"
    WHERE media_search_vector(title, description, keywords, transcript, chapter)
          @@ websearch_to_tsquery('french', f_unaccent(${q}))
      AND (${!onlyPublished} OR status = 'PUBLISHED')
    ORDER BY ts_rank_cd(media_search_vector(title, description, keywords, transcript, chapter),
                        websearch_to_tsquery('french', f_unaccent(${q}))) DESC
    LIMIT 500`;
  if (rows.length > 0) return rows.map((r) => r.id);
  // Repli tolérant aux fautes : similarité trigramme sur le titre
  const fuzzy = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Media"
    WHERE similarity(f_unaccent(title), f_unaccent(${q})) > 0.2
      AND (${!onlyPublished} OR status = 'PUBLISHED')
    ORDER BY similarity(f_unaccent(title), f_unaccent(${q})) DESC
    LIMIT 100`;
  return fuzzy.map((r) => r.id);
}

export async function suggest(q: string, limit = 8): Promise<Array<{ title: string; slug: string; type: string }>> {
  if (q.length < 2) return [];
  return prisma.$queryRaw<Array<{ title: string; slug: string; type: string }>>`
    SELECT title, slug, type::text FROM "Media"
    WHERE status = 'PUBLISHED' AND (f_unaccent(title) ILIKE f_unaccent(${'%' + q + '%'}) OR similarity(f_unaccent(title), f_unaccent(${q})) > 0.25)
    ORDER BY similarity(f_unaccent(title), f_unaccent(${q})) DESC, "viewCount" DESC
    LIMIT ${limit}`;
}

// ---------------------------------------------------------------------------
// Catalogue filtré
// ---------------------------------------------------------------------------
export async function listMedia(query: CatalogQuery, opts?: { statuses?: MediaStatus[]; uploaderId?: string }) {
  const statuses = opts?.statuses ?? ['PUBLISHED'];
  const onlyPublished = statuses.length === 1 && statuses[0] === 'PUBLISHED';
  const where: Prisma.MediaWhereInput = { status: { in: statuses } };
  if (opts?.uploaderId) where.uploaderId = opts.uploaderId;
  if (query.type) where.type = query.type;
  if (query.cycle) where.cycle = { code: query.cycle };
  if (query.classe) where.classLevel = { code: query.classe };
  if (query.discipline) where.discipline = { code: query.discipline };
  if (query.theme) where.theme = { code: query.theme };
  if (query.langue) where.language = query.langue;
  if (query.niveau) where.difficulty = query.niveau;
  if (query.chaine) where.channel = { slug: query.chaine };
  if (query.duree === 'court') where.durationSec = { lt: 300 };
  if (query.duree === 'moyen') where.durationSec = { gte: 300, lte: 1200 };
  if (query.duree === 'long') where.durationSec = { gt: 1200 };
  if (query.depuis) {
    const days = { '7j': 7, '30j': 30, '365j': 365 }[query.depuis];
    where.publishedAt = { gte: new Date(Date.now() - days * 86400000) };
  }

  let rankedIds: string[] | null = null;
  if (query.q) {
    rankedIds = await searchIds(query.q, onlyPublished);
    where.id = { in: rankedIds };
  }

  const orderBy: Prisma.MediaOrderByWithRelationInput[] =
    query.tri === 'populaire'
      ? [{ viewCount: 'desc' }, { publishedAt: 'desc' }]
      : query.tri === 'aime'
        ? [{ likeCount: 'desc' }, { publishedAt: 'desc' }]
        : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

  const skip = (query.page - 1) * query.pageSize;

  if (rankedIds && query.tri === 'pertinence') {
    // Tri par pertinence : on respecte l'ordre renvoyé par la recherche plein texte.
    const all = await prisma.media.findMany({ where, include: mediaCardInclude });
    const pos = new Map(rankedIds.map((id, i) => [id, i]));
    all.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    const items = all.slice(skip, skip + query.pageSize).map(toCard);
    return { items, meta: paginationMeta(query.page, query.pageSize, all.length) };
  }

  const [total, rows] = await Promise.all([
    prisma.media.count({ where }),
    prisma.media.findMany({ where, include: mediaCardInclude, orderBy, skip, take: query.pageSize }),
  ]);
  return { items: rows.map(toCard), meta: paginationMeta(query.page, query.pageSize, total) };
}

export async function getTaxonomy() {
  const [cycles, disciplines, themes] = await Promise.all([
    prisma.cycle.findMany({ orderBy: { order: 'asc' }, include: { classes: { orderBy: { order: 'asc' } } } }),
    prisma.discipline.findMany({ orderBy: { name: 'asc' } }),
    prisma.theme.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return { cycles, disciplines, themes };
}

export type Taxonomy = Awaited<ReturnType<typeof getTaxonomy>>;

export function isVisibleTo(m: Pick<Media, 'status' | 'uploaderId' | 'contributorId'>, user: { id: string; role: string } | null) {
  if (m.status === 'PUBLISHED') return true;
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return m.uploaderId === user.id || m.contributorId === user.id;
}

export const mediaDetailInclude = {
  ...mediaCardInclude,
  uploader: { select: { id: true, firstName: true, lastName: true } },
  contributor: { select: { id: true, firstName: true, lastName: true, role: true } },
} satisfies Prisma.MediaInclude;

// Recherche par slug, par code court ou par identifiant.
export async function findMediaByKey(key: string) {
  return prisma.media.findFirst({
    where: { OR: [{ slug: key }, { id: key }, { shortCode: key }] },
    include: mediaDetailInclude,
  });
}

export async function viewerFlags(mediaId: string, userId: string | null) {
  if (!userId) return { liked: false, favorited: false, positionSec: 0, subscribed: false };
  const [like, fav, hist] = await Promise.all([
    prisma.like.findUnique({ where: { userId_mediaId: { userId, mediaId } } }),
    prisma.favorite.findUnique({ where: { userId_mediaId: { userId, mediaId } } }),
    prisma.watchHistory.findUnique({ where: { userId_mediaId: { userId, mediaId } } }),
  ]);
  return { liked: !!like, favorited: !!fav, positionSec: hist?.positionSec ?? 0, completed: hist?.completed ?? false };
}
