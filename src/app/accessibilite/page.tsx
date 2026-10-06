import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Accessibilité' };
export default function AccessibilitePage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">Accessibilité</h1>
      <div className="card space-y-3 p-6 text-sm leading-relaxed">
        <p>La plateforme vise la conformité au niveau AA des WCAG 2.1 : navigation complète au clavier (lien d’évitement, focus visible, raccourcis du lecteur : espace/K lecture, J/L ±10 s, F plein écran, M muet), contrastes vérifiés pour la charte SIMEN, libellés de formulaires explicites, messages d’état annoncés aux lecteurs d’écran, sous-titres WebVTT pour les vidéos lorsqu’ils sont fournis, transcription textuelle pour les audios, et forme d’onde accompagnée d’un curseur accessible.</p>
        <p>L’interface est disponible en français, en wolof et en arabe (sens de lecture droite-à-gauche).</p>
        <p>Si vous rencontrez un obstacle, signalez-le à la cellule pédagogique numérique du Ministère en précisant la page et la difficulté rencontrée.</p>
      </div>
    </article>
  );
}
