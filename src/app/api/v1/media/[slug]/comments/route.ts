import { prisma } from '@/lib/db';
import { handler, ok, created, notFound, parseJson, rateLimit, ApiError } from '@/lib/api';
import { getCurrentUser, requireUser } from '@/lib/auth';
import { findMediaByKey, isVisibleTo } from '@/lib/media';
import { commentSchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const authorSelect = { id: true, firstName: true, lastName: true, role: true } as const;

// GET /api/v1/media/:slug/comments — commentaires visibles (fil + réponses)
export const GET = handler(async (_req, { params }) => {
  const media = await findMediaByKey(params.slug);
  const user = await getCurrentUser();
  if (!media || !isVisibleTo(media, user)) throw notFound();
  const statusFilter = user?.role === 'ADMIN' ? undefined : { in: ['VISIBLE' as const] };
  const comments = await prisma.comment.findMany({
    where: { mediaId: media.id, ...(statusFilter ? { status: statusFilter } : {}) },
    include: { author: { select: authorSelect } },
    orderBy: { createdAt: 'asc' },
  });
  return ok(comments);
});

// POST /api/v1/media/:slug/comments — publier un commentaire (utilisateur authentifié)
export const POST = handler(async (req, { params }) => {
  const user = await requireUser();
  rateLimit(`comment:${user.id}`, 30, 3600);
  const media = await findMediaByKey(params.slug);
  if (!media || media.status !== 'PUBLISHED') throw notFound('Les commentaires ne sont ouverts que sur les contenus publiés.');
  const data = await parseJson(req, commentSchema);
  let parent = null;
  if (data.parentId) {
    parent = await prisma.comment.findFirst({ where: { id: data.parentId, mediaId: media.id } });
    if (!parent) throw new ApiError(422, 'Commentaire parent introuvable.', 'VALIDATION');
  }
  const requireApproval = (await prisma.setting.findUnique({ where: { key: 'moderation.commentsRequireApproval' } }))?.value === 'true';
  const comment = await prisma.comment.create({
    data: { mediaId: media.id, authorId: user.id, content: data.content, parentId: parent?.id ?? null, status: requireApproval && user.role !== 'ADMIN' ? 'PENDING' : 'VISIBLE' },
    include: { author: { select: authorSelect } },
  });
  if (comment.status === 'VISIBLE') await prisma.media.update({ where: { id: media.id }, data: { commentCount: { increment: 1 } } });
  if (parent && parent.authorId !== user.id) {
    await notify({ userId: parent.authorId, type: 'COMMENT_REPLY', title: `${user.firstName} ${user.lastName} a répondu à votre commentaire`, body: data.content.slice(0, 140), link: `/media/${media.slug}#commentaires` });
  }
  return created(comment);
});
