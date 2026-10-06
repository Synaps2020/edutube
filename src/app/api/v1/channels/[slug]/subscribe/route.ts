import { prisma } from '@/lib/db';
import { handler, ok, notFound } from '@/lib/api';
import { requireUser } from '@/lib/auth';

async function toggle(slug: string, on: boolean) {
  const user = await requireUser();
  const channel = await prisma.channel.findUnique({ where: { slug } });
  if (!channel) throw notFound('Chaîne introuvable.');
  if (on) await prisma.subscription.upsert({ where: { userId_channelId: { userId: user.id, channelId: channel.id } }, update: {}, create: { userId: user.id, channelId: channel.id } });
  else await prisma.subscription.deleteMany({ where: { userId: user.id, channelId: channel.id } });
  const count = await prisma.subscription.count({ where: { channelId: channel.id } });
  return ok({ subscribed: on, subscribers: count });
}

// POST /api/v1/channels/:slug/subscribe — s'abonner ; DELETE — se désabonner
export const POST = handler(async (_req, { params }) => toggle(params.slug, true));
export const DELETE = handler(async (_req, { params }) => toggle(params.slug, false));
