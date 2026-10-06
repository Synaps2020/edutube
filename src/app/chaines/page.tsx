import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'Chaînes' };

export default async function ChainesPage() {
  let channels: Array<{ slug: string; name: string; description: string | null; isOfficial: boolean; _count: { subscribers: number; media: number } }> = [];
  try {
    channels = await prisma.channel.findMany({
      orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { subscribers: true, media: true } } },
    });
  } catch {
    // La carte SIMEN TV reste disponible pendant une indisponibilité temporaire de la base.
  }

  return (
    <div className="space-y-7">
      <header className="rounded-3xl bg-simen-blue-darker px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-simen-orange">EduTube</p>
        <h1 className="mt-2 text-3xl font-black text-white">Les chaînes éducatives</h1>
        <p className="mt-3 max-w-2xl text-simen-sky-light">Retrouvez les chaînes officielles, les contenus pédagogiques et les plateformes numériques partenaires du Ministère.</p>
      </header>

      <section aria-labelledby="simen-tv" className="rounded-3xl border border-simen-blue/20 bg-simen-blue-light p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-simen-blue text-xl font-black text-white">S</span><div><p className="text-sm font-bold text-simen-blue-darker">CHAÎNE PARTENAIRE</p><h2 id="simen-tv" className="mt-1 text-2xl font-black text-slate-900">SIMEN TV</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Accédez aux programmes, directs et ressources numériques proposés par le SIMEN et le Ministère de l’Éducation nationale.</p></div></div>
          <Link href="/chaines/simen-tv" className="rounded-full bg-simen-blue px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-simen-blue-dark">Ouvrir SIMEN TV →</Link>
        </div>
      </section>

      <section aria-labelledby="education-sn" className="rounded-3xl border border-simen-orange/30 bg-simen-orange-light p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-simen-orange text-xl font-black text-white">E</span><div><p className="text-sm font-bold text-simen-orange-dark">SITE OFFICIEL DU MINISTÈRE</p><h2 id="education-sn" className="mt-1 text-2xl font-black text-slate-900">Éducation.sn</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Actualités, médias, publications, programmes et galeries du Ministère de l’Éducation nationale.</p></div></div>
          <Link href="/chaines/education-sn" className="rounded-full bg-simen-orange px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-simen-orange-dark">Voir les rubriques →</Link>
        </div>
      </section>

      <section><div className="mb-4"><p className="text-sm font-bold uppercase tracking-wide text-simen-orange-dark">Sur EduTube</p><h2 className="mt-1 text-2xl font-black">Toutes les chaînes</h2></div>{channels.length ? <div className="grid gap-4 md:grid-cols-2">{channels.map((channel) => <Link key={channel.slug} href={`/chaines/${channel.slug}`} className="group rounded-2xl border border-simen-gray-light bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-simen-blue hover:shadow-md"><div className="flex gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-white ${channel.isOfficial ? 'bg-simen-blue' : 'bg-simen-orange'}`}>{channel.name[0]}</span><div className="min-w-0"><h3 className="font-black text-slate-900 group-hover:text-simen-blue">{channel.isOfficial && <span className="mr-1 text-simen-blue">✓</span>}{channel.name}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{channel.description ?? 'Découvrez les contenus de cette chaîne.'}</p><p className="mt-3 text-xs font-semibold text-slate-500">{channel._count.media} contenus · {channel._count.subscribers} abonnés</p></div></div></Link>)}</div> : <p className="rounded-2xl border border-dashed border-simen-gray-light bg-white p-6 text-sm text-simen-gray">Les autres chaînes réapparaîtront dès que la base de données sera disponible.</p>}</section>
    </div>
  );
}
