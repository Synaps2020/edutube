import { prisma } from '@/lib/db';
import { handler, noContent, notFound, forbidden } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

// DELETE /api/v1/comments/:id — suppression par l'auteur ou un administrateur
export const DELETE = handler(async (req, { params }) => {
  const user = await requireUser();
  const comment = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!comment) throw notFound();
  if (comment.authorId !== user.id && user.role !== 'ADMIN') throw forbidden();
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { parentId: comment.id } }),
    prisma.comment.delete({ where: { id: comment.id } }),
  ]);
  const visible = await prisma.comment.count({ where: { mediaId: comment.mediaId, status: 'VISIBLE' } });
  await prisma.media.update({ where: { id: comment.mediaId }, data: { commentCount: visible } });
  if (user.role === 'ADMIN' && comment.authorId !== user.id) await audit({ actorId: user.id, action: 'COMMENT_DELETE', entity: 'Comment', entityId: comment.id });
  return noContent();
});
