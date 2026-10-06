import type { Metadata } from 'next';
import Image from 'next/image';
export const metadata: Metadata = { title: 'À propos' };
export default function AProposPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">À propos d’EduTube</h1>
      <div className="card space-y-3 p-6 text-sm leading-relaxed">
        <Image src="/img/logo-simen.png" alt="SIMEN" width={200} height={108} className="h-20 w-auto" />
        <p>EduTube est la plateforme officielle de gestion et de diffusion de contenus pédagogiques vidéo et audio du Ministère de l’Éducation nationale de la République du Sénégal, opérée par le SIMEN (Système d’Information de Management de l’Éducation Nationale).</p>
        <p>Entièrement hébergée sur les serveurs du Ministère, elle offre à l’ensemble de la communauté éducative — des écoles élémentaires de Ziguinchor aux lycées de Saint-Louis, des daaras modernes aux CEM de Tambacounda — un espace de référence, souverain et modéré, pour accéder à des ressources validées, en français, en wolof et en arabe.</p>
        <p>Les contenus sont classés par cycle (Primaire, Moyen, Secondaire), par classe (CI à Terminale), par discipline et par thématique transversale, pour accompagner les élèves jusqu’au CFEE, au BFEM et au Baccalauréat.</p>
        <p>Enseignants et élèves peuvent proposer des contenus, commenter, recommander, créer des listes de lecture et suivre leur progression. La publication reste de la responsabilité de la cellule pédagogique numérique du Ministère.</p>
      </div>
    </article>
  );
}
