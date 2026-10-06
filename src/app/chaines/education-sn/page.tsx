import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Chaînes Éducation.sn' };

const channels = [
  { title: 'Actualités', description: 'Communiqués, annonces et informations du Ministère.', href: 'https://education.sn/posts', icon: '◷' },
  { title: 'Le Ministère', description: 'Organisation, services et informations institutionnelles.', href: 'https://education.sn/organigrameministere', icon: '▦' },
  { title: 'Système éducatif', description: 'Organisation et fonctionnement des cycles d’enseignement.', href: 'https://education.sn/system-educatifs', icon: '◉' },
  { title: 'Programmes & projets', description: 'Initiatives et projets pour l’éducation au Sénégal.', href: 'https://education.sn/programme-et-projets', icon: '↗' },
  { title: 'Publications', description: 'Documents et ressources publiés par le Ministère.', href: 'https://education.sn/publications', icon: '▤' },
  { title: 'Médias', description: 'Vidéos scolaires et podcasts officiels.', href: 'https://education.sn/videos', icon: '▶' },
  { title: 'Galeries', description: 'Images et temps forts des activités du Ministère.', href: 'https://education.sn/galeries', icon: '▧' },
];

export default function EducationSnChannelsPage() {
  return (
    <div className="space-y-8">
      <header className="rounded-3xl bg-simen-blue-darker px-6 py-11 text-white sm:px-10"><p className="text-sm font-bold uppercase tracking-[.16em] text-simen-orange">Partenaire institutionnel</p><h1 className="mt-2 text-3xl font-black text-white">Les chaînes d’Éducation.sn</h1><p className="mt-3 max-w-2xl text-simen-sky-light">Accédez directement aux rubriques du site officiel du Ministère de l’Éducation nationale.</p><a href="https://education.sn/" target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-simen-orange px-5 py-3 text-sm font-bold text-white transition hover:bg-simen-orange-dark">Visiter education.sn ↗</a></header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{channels.map((channel) => <a key={channel.href} href={channel.href} target="_blank" rel="noreferrer" className="group rounded-2xl border border-simen-gray-light bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-simen-blue hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-simen-blue-light text-lg font-black text-simen-blue">{channel.icon}</span><h2 className="mt-4 font-black text-slate-900 group-hover:text-simen-blue">{channel.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{channel.description}</p><span className="mt-4 inline-block text-sm font-bold text-simen-orange-dark">Ouvrir la rubrique ↗</span></a>)}</section>
      <Link href="/chaines" className="inline-flex text-sm font-bold text-simen-blue hover:text-simen-blue-dark">← Retour aux chaînes EduTube</Link>
    </div>
  );
}
