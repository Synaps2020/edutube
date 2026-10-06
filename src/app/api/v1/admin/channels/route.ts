import { prisma } from '@/lib/db';
import { handler, ok, created, parseJson } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { channelSchema } from '@/lib/validation';
import { slugify, randomSuffix } from '@/lib/utils';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/channels — toutes les chaînes
export const GET = handler(async () => {
  await requireRole('ADMIN');
  return ok(await prisma.channel.findMany({ include: { owner: { select: { id: true, firstName: true, lastName: true, role: true } }, _count: { select: { media: true, subscribers: true } } }, orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }] }));
});

// POST /api/v1/admin/channels — créer une chaîne (officielle ou rattachée à un enseignant)
export const POST = handler(async (req) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, channelSchema);
  let slug = slugify(data.name);
  if (await prisma.channel.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix(4)}`;
  const ch = await prisma.channel.create({ data: { slug, name: data.name, description: data.description ?? null, isOfficial: data.isOfficial, ownerId: data.ownerId ?? admin.id } });
  await audit({ actorId: admin.id, action: 'CHANNEL_CREATE', entity: 'Channel', entityId: ch.id });
  return created(ch);
});
