import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Mentions légales' };
export default function MentionsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">Mentions légales</h1>
      <div className="card space-y-3 p-6 text-sm leading-relaxed">
        <p><strong>Éditeur :</strong> Ministère de l’Éducation nationale de la République du Sénégal — SIMEN (Système d’Information de Management de l’Éducation Nationale), Dakar.</p>
        <p><strong>Hébergement :</strong> serveurs du Ministère de l’Éducation nationale, République du Sénégal. Aucune donnée n’est transférée vers un service tiers ou un cloud étranger.</p>
        <p><strong>Données personnelles :</strong> traitement conforme à la loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel. Droit d’accès, de rectification et d’opposition exerçable auprès de la cellule pédagogique numérique du Ministère, via l’établissement, l’IEF ou l’IA de rattachement.</p>
        <p><strong>Cookies :</strong> seuls des cookies strictement nécessaires sont utilisés (session authentifiée, langue de l’interface). Aucun traceur publicitaire.</p>
        <p><strong>Propriété intellectuelle :</strong> les contenus sont publiés sous la licence indiquée sur chaque fiche (Creative Commons par défaut). Le logotype SIMEN et la charte graphique sont la propriété du Ministère.</p>
      </div>
    </article>
  );
}
