import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { listMedia } from '@/lib/media';
import { catalogQuerySchema } from '@/lib/validation';
import { MediaGrid } from '@/components/media/MediaCard';
import { Pagination } from '@/components/ui';
import { SubscribeButton } from '@/components/catalog/SubscribeButton';
import { ROLE_LABELS } from '@/lib/utils';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await prisma.channel.findUnique({ where: { slug: params.slug } });
  return { title: c?.name ?? 'Chaîne' };
}

export default async function ChainePage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | undefined> }) {
  const channel = await prisma.channel.findUnique({ where: { slug: params.slug }, include: { owner: { select: { firstName: true, lastName: true, role: true, establishment: true, bio: true } }, _count: { select: { subscribers: true } } } });
  if (!channel) notFound();
  const user = await getCurrentUser();
  const parsed = catalogQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  query.chaine = channel.slug;
  const [result, subscribed] = await Promise.all([listMedia(query), user ? prisma.subscription.findUnique({ where: { userId_channelId: { userId: user.id, channelId: channel.id } } }) : null]);
  return (
    <div>
      <header className="card mb-6 flex flex-wrap items-center gap-4 p-6">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white ${channel.isOfficial ? 'bg-simen-blue' : 'bg-simen-orange'}`} aria-hidden="true">{channel.name[0]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{channel.isOfficial && <span className="text-simen-blue" title="Chaîne officielle">✔ </span>}{channel.name}</h1>
          <p className="text-sm text-simen-gray-mid">{channel.isOfficial ? 'Chaîne officielle du Ministère de l’Éducation nationale' : `${ROLE_LABELS[channel.owner.role]} · ${channel.owner.firstName} ${channel.owner.lastName}${channel.owner.establishment ? ' · ' + channel.owner.establishment : ''}`} · {channel._count.subscribers} abonnés · {result.meta.total} contenus</p>
          {channel.description && <p className="mt-2 text-sm text-simen-gray">{channel.description}</p>}
        </div>
        <SubscribeButton slug={channel.slug} initial={!!subscribed} loggedIn={!!user} />
      </header>
      <MediaGrid items={result.items} emptyLabel="Cette chaîne n’a pas encore de contenu publié." />
      <Pagination page={result.meta.page} pageCount={result.meta.pageCount} href={{ pathname: `/chaines/${channel.slug}` }} />
    </div>
  );
}
