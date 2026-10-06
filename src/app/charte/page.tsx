import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Charte communautaire' };

export default function ChartePage() {
  return (
    <article className="prose-fr mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Charte communautaire</h1>
      <p className="mt-2 text-sm text-simen-gray-mid">Plateforme EduTube — Ministère de l’Éducation nationale de la République du Sénégal. Version 1.0.</p>
      <section className="card mt-6 space-y-3 p-6 text-sm leading-relaxed">
        <h2 className="text-lg font-bold">1. Objet</h2>
        <p>EduTube est un espace éducatif public, souverain et modéré. Il rassemble des vidéos et des audios pédagogiques validés par le Ministère, destinés aux élèves et enseignants du Primaire (CI à CM2), du Moyen (6e à 3e) et du Secondaire (Seconde, Première, Terminale). La présente charte fixe les règles de participation ; son acceptation est requise pour créer un compte.</p>
        <h2 className="text-lg font-bold">2. Valeurs</h2>
        <p>Respect, bienveillance, rigueur pédagogique et esprit de service public. Les échanges se font en français, en wolof, en arabe ou dans toute langue nationale, dans un registre correct et accessible à tous, y compris aux plus jeunes élèves.</p>
        <h2 className="text-lg font-bold">3. Contributions et propositions</h2>
        <p>Les enseignants et les élèves peuvent proposer des contenus. Seuls les administrateurs (cellule pédagogique numérique du MEN) publient. Toute proposition doit être conforme aux programmes officiels, libre de droits ou sous licence compatible (Creative Commons recommandée), et respecter le droit à l’image : aucune personne identifiable — en particulier un mineur — ne doit apparaître sans autorisation écrite. Les propositions refusées reçoivent un retour motivé et peuvent être resoumises après correction.</p>
        <h2 className="text-lg font-bold">4. Commentaires et interactions</h2>
        <p>Les commentaires servent à poser des questions, partager des remarques constructives et s’entraider. Sont interdits : les insultes, le harcèlement, les propos discriminatoires, la publicité, les liens vers des contenus non éducatifs, la diffusion d’informations personnelles (numéros de téléphone, adresses), la tricherie aux examens (partage de sujets, corrigés d’épreuves en cours) et tout contenu contraire aux lois de la République du Sénégal.</p>
        <h2 className="text-lg font-bold">5. Signalement et modération</h2>
        <p>Tout utilisateur authentifié peut signaler un contenu ou un commentaire. La modération examine les signalements, peut masquer ou retirer un élément, avertir, puis suspendre un compte en cas de manquements répétés. Les décisions sont tracées dans un journal et motivées. Un utilisateur suspendu peut demander un réexamen auprès de son établissement, de son IEF ou de son IA.</p>
        <h2 className="text-lg font-bold">6. Données personnelles</h2>
        <p>Les données collectées (identité, établissement, classe, historique de visionnage) servent uniquement au fonctionnement pédagogique de la plateforme et à des statistiques d’usage agrégées. Elles sont hébergées sur les serveurs du Ministère, au Sénégal, et ne sont jamais cédées à des tiers. Chaque utilisateur peut consulter et corriger ses informations dans « Mon profil ».</p>
        <h2 className="text-lg font-bold">7. Licences</h2>
        <p>Sauf mention contraire, les contenus publiés sont diffusés sous licence Creative Commons BY-NC-SA 4.0 : réutilisation autorisée à des fins non commerciales, avec attribution et partage dans les mêmes conditions. Le téléchargement n’est possible que lorsque l’administrateur l’a autorisé.</p>
        <h2 className="text-lg font-bold">8. Contact</h2>
        <p>Cellule pédagogique numérique — Ministère de l’Éducation nationale, Dakar. Les demandes passent par les établissements, les IEF et les IA.</p>
      </section>
    </article>
  );
}
