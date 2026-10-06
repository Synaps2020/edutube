import { prisma } from '@/lib/db';
import { handler, ok, noContent, parseJson, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { channelSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

// PATCH /api/v1/admin/channels/:id
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, channelSchema.partial());
  const ch = await prisma.channel.update({ where: { id: params.id }, data });
  await audit({ actorId: admin.id, action: 'CHANNEL_UPDATE', entity: 'Channel', entityId: ch.id });
  return ok(ch);
});

// DELETE /api/v1/admin/channels/:id — uniquement si vide
export const DELETE = handler(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const n = await prisma.media.count({ where: { channelId: params.id } });
  if (n > 0) throw new ApiError(409, 'Impossible de supprimer une chaîne contenant des médias.', 'CONFLIT');
  await prisma.channel.delete({ where: { id: params.id } });
  await audit({ actorId: admin.id, action: 'CHANNEL_DELETE', entity: 'Channel', entityId: params.id });
  return noContent();
});
