import Link from 'next/link';
import { ShortCodeForm } from '@/components/catalog/ShortCodeForm';
import { MediaGrid } from '@/components/media/MediaCard';
import { getTaxonomy, listMedia } from '@/lib/media';
import { prisma } from '@/lib/db';
import { formatNumber } from '@/lib/utils';
import type { MediaCardDTO } from '@/lib/media';

const officialLinks = [
  { title: 'Actualités du Ministère', text: 'Communiqués, annonces et activités nationales.', href: 'https://education.sn/posts' },
  { title: 'Médiathèque officielle', text: 'Vidéos scolaires, podcasts et ressources du MEN.', href: 'https://education.sn/videos' },
  { title: 'Programmes & projets', text: 'Initiatives pour la qualité et l’équité éducative.', href: 'https://education.sn/programme-et-projets' },
];

const discoveryTiles = [
  { title: 'Vidéos récentes', text: 'Les derniers cours publiés', href: '#videos-recentes', icon: 'play', color: 'bg-simen-blue' },
  { title: 'Les plus suivies', text: 'Les chaînes de la communauté', href: '#chaines-suivies', icon: 'users', color: 'bg-[#147aa1]' },
  { title: 'Activités récentes', text: 'Les informations officielles', href: '#activites-recentes', icon: 'calendar', color: 'bg-simen-orange' },
  { title: 'Les plus visitées', text: 'Les contenus populaires', href: '#plus-visitees', icon: 'trend', color: 'bg-[#00853f]' },
];

function TileIcon({ name }: { name: string }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true };
  if (name === 'play') return <svg {...common}><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg>;
  if (name === 'users') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 11a3 3 0 1 0-1.5-5.6M17 14.5a4.6 4.6 0 0 1 3.5 4.5" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
  return <svg {...common}><path d="M4 18V9M10 18V5M16 18v-7M22 18V3" /><path d="M2 21h21" /></svg>;
}

export default async function HomePage() {
  let recentVideos: MediaCardDTO[] = [];
  let popular: MediaCardDTO[] = [];
  let liked: MediaCardDTO[] = [];
  let taxonomy: Awaited<ReturnType<typeof getTaxonomy>> | null = null;
  let channels: Array<{ id: string; slug: string; name: string; description: string | null; isOfficial: boolean; _count: { subscribers: number; media: number } }> = [];

  try {
    const data = await Promise.race([
      Promise.all([
        getTaxonomy(),
        listMedia({ page: 1, pageSize: 8, tri: 'recent', type: 'VIDEO' }).then((result) => result.items),
        listMedia({ page: 1, pageSize: 8, tri: 'populaire' }).then((result) => result.items),
        listMedia({ page: 1, pageSize: 8, tri: 'aime' }).then((result) => result.items),
        prisma.channel.findMany({
          include: { _count: { select: { subscribers: true, media: true } } },
          orderBy: [{ subscribers: { _count: 'desc' } }, { isOfficial: 'desc' }, { name: 'asc' }],
          take: 4,
        }),
      ]),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (data) [taxonomy, recentVideos, popular, liked, channels] = data;
  } catch {
    // L'accueil reste accessible pendant l'installation ou une indisponibilité de PostgreSQL.
  }

  return (
    <div className="space-y-10 pb-10">
      <nav aria-label="Découvrir les rubriques" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {discoveryTiles.map((tile) => <a key={tile.title} href={tile.href} className="group flex items-center gap-4 rounded-xl border border-simen-gray-light/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-simen-blue hover:shadow-[0_10px_22px_rgba(0,153,204,.12)]"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${tile.color}`}><TileIcon name={tile.icon} /></span><span><strong className="block text-sm text-simen-gray-dark group-hover:text-simen-blue">{tile.title}</strong><span className="mt-0.5 block text-xs text-simen-gray">{tile.text}</span></span><span className="ml-auto text-simen-gray-mid group-hover:text-simen-blue" aria-hidden="true">→</span></a>)}
      </nav>

      <section className="overflow-hidden rounded-2xl border border-simen-blue/20 bg-[linear-gradient(115deg,#fff_0%,#f0f9fc_62%,#fff7e8_100%)] shadow-[0_18px_45px_rgba(0,153,204,.10)]">
        <div className="grid gap-7 px-6 py-8 sm:px-10 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[.12em] text-simen-orange-dark">DPTIC · Ministère de l’Éducation nationale</p><h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">À découvrir aujourd’hui</h1><p className="mt-3 max-w-2xl text-base leading-relaxed text-simen-gray">Retrouvez rapidement les cours, vidéos et ressources utiles pour apprendre, enseigner et rester informé.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/catalogue" className="btn-primary">Explorer le catalogue</Link><Link href="/catalogue?type=AUDIO" className="btn-secondary">Écouter les audios</Link></div></div>
          <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-[0_12px_30px_rgba(23,33,43,.1)] backdrop-blur"><ShortCodeForm /></div>
        </div><div className="tricolore h-1 w-full" aria-hidden="true" />
      </section>

      {taxonomy?.themes.length ? <section aria-label="Thématiques"><div className="flex gap-2 overflow-x-auto pb-1"><Link href="/catalogue" className="shrink-0 rounded-full bg-simen-gray-dark px-4 py-2 text-sm font-bold text-white">Tout voir</Link>{taxonomy.themes.map((theme) => <Link key={theme.code} href={`/catalogue?theme=${theme.code}`} className="shrink-0 rounded-full border border-simen-gray-light bg-white px-4 py-2 text-sm font-semibold text-simen-gray-dark transition hover:border-simen-blue hover:bg-simen-blue-light">{theme.name}</Link>)}</div></section> : null}

      <section id="videos-recentes" aria-labelledby="recent-videos"><div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-simen-orange-dark">À la une</p><h2 id="recent-videos" className="mt-1 text-2xl font-black">Vidéos récentes</h2></div><Link href="/catalogue?type=VIDEO" className="text-sm font-bold text-simen-blue hover:text-simen-blue-dark">Voir toutes →</Link></div><MediaGrid items={recentVideos} emptyLabel="Les nouvelles vidéos apparaîtront ici dès leur publication." /></section>

      <section id="plus-visitees" aria-labelledby="popular"><div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-simen-orange-dark">Tendances</p><h2 id="popular" className="mt-1 text-2xl font-black">Les plus visitées</h2></div><Link href="/catalogue?tri=populaire" className="text-sm font-bold text-simen-blue hover:text-simen-blue-dark">Voir toutes →</Link></div><MediaGrid items={popular} emptyLabel="Les contenus les plus consultés apparaîtront ici." /></section>

      <section id="chaines-suivies" aria-labelledby="channels"><div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-simen-orange-dark">Communauté</p><h2 id="channels" className="mt-1 text-2xl font-black">Les chaînes les plus suivies</h2></div><Link href="/chaines" className="text-sm font-bold text-simen-blue hover:text-simen-blue-dark">Toutes les chaînes →</Link></div>{channels.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{channels.map((channel) => <Link key={channel.id} href={`/chaines/${channel.slug}`} className="group rounded-xl border border-simen-gray-light bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-simen-blue hover:shadow-[0_12px_24px_rgba(0,153,204,.12)]"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-simen-blue-light font-black text-simen-blue-darker">{channel.name.slice(0, 1)}</span><div className="min-w-0"><h3 className="truncate font-bold group-hover:text-simen-blue">{channel.isOfficial && <span className="mr-1 text-simen-blue" aria-label="Chaîne officielle">✔</span>}{channel.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-simen-gray">{channel.description || 'Chaîne de ressources pédagogiques.'}</p></div></div><div className="mt-4 flex gap-4 border-t border-simen-gray-lighter pt-3 text-xs text-simen-gray"><span><strong className="text-simen-gray-dark">{formatNumber(channel._count.subscribers)}</strong> abonnés</span><span><strong className="text-simen-gray-dark">{channel._count.media}</strong> médias</span></div></Link>)}</div> : <p className="card px-6 py-10 text-center text-sm text-simen-gray-mid">Les chaînes apparaîtront dès que la base de données sera disponible.</p>}</section>

      <section aria-labelledby="liked"><div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-simen-orange-dark">Sélection de la communauté</p><h2 id="liked" className="mt-1 text-2xl font-black">Les plus appréciées</h2></div><Link href="/catalogue?tri=aime" className="text-sm font-bold text-simen-blue hover:text-simen-blue-dark">Voir toutes →</Link></div><MediaGrid items={liked} emptyLabel="Les contenus les plus appréciés apparaîtront ici." /></section>

      <section id="activites-recentes" aria-labelledby="official" className="rounded-xl border border-simen-gray-light bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-simen-orange-dark">À suivre</p><h2 id="official" className="mt-1 text-2xl font-black">Activités récentes du Ministère</h2></div><Link href="/chaines/education-sn" className="text-sm font-bold text-simen-blue hover:text-simen-blue-dark">Toutes les rubriques →</Link></div><div className="mt-5 grid gap-4 md:grid-cols-3">{officialLinks.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="rounded-lg border border-simen-gray-light p-4 transition hover:border-simen-blue hover:bg-simen-blue-light"><h3 className="font-bold text-simen-blue-darker">{link.title}</h3><p className="mt-2 text-sm text-simen-gray">{link.text}</p><span className="mt-3 inline-block text-sm font-semibold text-simen-orange-dark">Ouvrir ↗</span></a>)}</div></section>
    </div>
  );
}
