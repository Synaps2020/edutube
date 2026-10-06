import { prisma } from '@/lib/db';
import { handler, ok, notFound, parseJson } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { audit, moderationDecision } from '@/lib/audit';
import { z } from 'zod';

// PATCH /api/v1/admin/comments/:id — masquer / rétablir / approuver un commentaire
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const { status, reason } = await parseJson(req, z.object({ status: z.enum(['VISIBLE', 'HIDDEN']), reason: z.string().max(500).optional().nullable() }));
  const c = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!c) throw notFound();
  await prisma.comment.update({ where: { id: c.id }, data: { status, hiddenReason: status === 'HIDDEN' ? reason ?? 'Masqué par la modération' : null } });
  const visible = await prisma.comment.count({ where: { mediaId: c.mediaId, status: 'VISIBLE' } });
  await prisma.media.update({ where: { id: c.mediaId }, data: { commentCount: visible } });
  await moderationDecision({ moderatorId: admin.id, targetType: 'COMMENT', targetId: c.id, action: status === 'HIDDEN' ? 'HIDE' : 'RESTORE', reason });
  await audit({ actorId: admin.id, action: 'COMMENT_MODERATE', entity: 'Comment', entityId: c.id, details: { status } });
  return ok({ status });
});

// GET /api/v1/admin/comments/:id — pas nécessaire ; la liste passe par /admin/comments
