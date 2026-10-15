import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, PenLine, CheckCircle2 } from 'lucide-react';
import { ButtonLink } from '../components/primitives';
export function About() {
  return (
    <>
      <section className="container about-editorial">
        <div>
          <span className="eyebrow">LE SAVOIR A BESOIN DE CIRCULER</span>
          <h1>
            Une notion comprise.
            <br />
            Une porte ouverte.
          </h1>
          <p>
            EduTube réunit cours et parcours pour les élèves du Sénégal. Notre ambition : rendre les
            ressources plus faciles à trouver et l’apprentissage plus facile à poursuivre.
          </p>
          <ButtonLink to="/catalogue">
            Trouver ma première ressource
            <ArrowRight size={17} />
          </ButtonLink>
        </div>
        <div className="about-picture">
          <img src="/img/learning-campaign.png" alt="Trois jeunes adultes apprennent ensemble" />
          <span>DE LA CURIOSITÉ À LA CONFIANCE.</span>
        </div>
      </section>
      <section className="container about-method">
        <span className="eyebrow">COMMENT ON APPREND ICI</span>
        <h2>Moins de dispersion. Plus de pratique.</h2>
        <div>
          {[
            {
              icon: BookOpen,
              title: 'Comprendre',
              text: 'Choisir une notion et lire une explication, avec un exemple concret.',
            },
            {
              icon: PenLine,
              title: 'S’approprier',
              text: 'Prendre ses propres notes et conserver une fiche de révision.',
            },
            {
              icon: CheckCircle2,
              title: 'Vérifier',
              text: 'Répondre au quiz, lire la correction et revenir sur une difficulté.',
            },
          ].map((item, index) => (
            <article key={item.title}>
              <span>0{index + 1}</span>
              <item.icon size={28} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container about-faq">
        <div>
          <span className="eyebrow">DES RÉPONSES CLAIRES</span>
          <h2>Avant de commencer.</h2>
          <p>Une plateforme utile explique aussi ses limites.</p>
        </div>
        <div>
          <details open>
            <summary>Les cours sont-ils gratuits ?</summary>
            <p>
              Oui. Dans cette démonstration, les fiches, quiz et outils d’apprentissage sont
              accessibles gratuitement, sans paiement.
            </p>
          </details>
          <details>
            <summary>Faut-il créer un compte ?</summary>
            <p>
              Le catalogue est public. Un compte est nécessaire pour accéder à votre espace et aux
              chapitres complets. Vos notes, favoris et progression sont enregistrés dans votre
              compte et retrouvés après connexion.
            </p>
          </details>
          <details>
            <summary>Où sont les vidéos ?</summary>
            <p>
              Les chapitres au format vidéo proposent un lecteur avec les commandes de lecture. Vous
              pouvez avancer à votre rythme, utiliser les fiches et les notes, puis passer au
              chapitre suivant. Certains chapitres se débloquent après la réussite d’un examen.
            </p>
          </details>
          <details id="confidentialite">
            <summary>Que deviennent mes données ?</summary>
            <p>
              Votre compte, vos notes, vos favoris, votre progression et vos tentatives de quiz sont
              enregistrés sur le serveur. Ils sont accessibles uniquement avec votre session. Aucun
              certificat n’est délivré.
            </p>
          </details>
          <details id="accessibilite">
            <summary>Puis-je naviguer au clavier ?</summary>
            <p>
              Les menus s’ouvrent avec Entrée ; Échap ferme le menu Explorer. Les boutons, champs et
              liens ont des états de focus. La mise en page s’adapte aux petits écrans. Un audit
              complet d’accessibilité reste à réaliser.
            </p>
          </details>
        </div>
      </section>
      <section className="container about-next">
        <h2>Votre prochain déclic est peut-être ici.</h2>
        <Link className="text-link" to="/parcours">
          Découvrir les parcours
          <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
