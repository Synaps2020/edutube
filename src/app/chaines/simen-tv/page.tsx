import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'SIMEN TV' };

const links = [
  { title: 'Canal Éducation — Direct et cours vidéo', description: 'Accéder aux programmes diffusés et aux cours en vidéo.', href: 'https://canal.education.sn/home/livetv/1/0', label: 'Regarder' },
  { title: 'Site du Ministère de l’Éducation nationale', description: 'Actualités, communiqués et informations institutionnelles.', href: 'https://www.education.sn/', label: 'Visiter le site' },
  { title: 'SIMEN — présentation officielle', description: 'Découvrir le Système d’Information et de Management de l’Éducation nationale.', href: 'https://www.education.sn/pages/systeme-dinformation-et-de-management-de-leducation-nationale-simen', label: 'En savoir plus' },
  { title: 'DPTIC — présentation officielle', description: 'Missions de la Division de la Promotion des TIC et du numérique éducatif.', href: 'https://www.education.sn/pages/division-de-la-promotion-des-technologies-de-linformation-et-de-la-communication-dptic', label: 'Découvrir la DPTIC' },
  { title: 'MEN Apps', description: 'Accéder aux applications numériques du Ministère avec un compte éducation.', href: 'https://apps.education.sn/', label: 'Ouvrir MEN Apps' },
];

export default function SimenTvPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="rounded-3xl bg-simen-blue-darker px-7 py-12 text-white sm:px-10"><p className="text-sm font-bold uppercase tracking-[.16em] text-simen-orange">Chaîne partenaire</p><h1 className="mt-2 text-4xl font-black text-white">SIMEN TV</h1><p className="mt-4 max-w-2xl leading-relaxed text-simen-sky-light">Tous les accès utiles vers les médias et services numériques du SIMEN et du Ministère de l’Éducation nationale.</p></header>
      <section aria-label="Liens SIMEN" className="grid gap-4 sm:grid-cols-2">{links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-simen-gray-light bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-simen-blue hover:shadow-md"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-simen-blue-light font-black text-simen-blue" aria-hidden="true">↗</span><h2 className="mt-4 font-black text-slate-900 group-hover:text-simen-blue">{link.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{link.description}</p><span className="mt-4 inline-block text-sm font-bold text-simen-orange-dark">{link.label} →</span></a>)}</section>
      <p className="rounded-2xl bg-simen-orange-light p-5 text-sm text-slate-700">Ces liens ouvrent les sites officiels dans un nouvel onglet. Leur disponibilité et leur contenu sont gérés par les organismes concernés.</p>
    </div>
  );
}
