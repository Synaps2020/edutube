import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  Users,
  Check,
  MoveUpRight,
} from 'lucide-react';
import { useLearning } from '../context';
import { CourseArt, CourseGrid, SectionHeading } from '../components/primitives';
import { EditorialBanner } from '../components/EditorialBanner';

export function Home() {
  const { courses, loading } = useLearning();
  const subjects = [...new Set(courses.map((course) => course.subject))].map((name) => {
    const course = courses.find((item) => item.subject === name)!;
    return { name, courseId: course.id, line: course.description, color: course.color };
  });
  return (
    <div className="home-page">
      <div className="campaign-wrap container">
        <EditorialBanner
          tone="blue"
          eyebrow="LA NOUVELLE GÉNÉRATION DU SAVOIR"
          title={
            <>
              Votre avenir
              <br />
              ne tient pas
              <br />
              dans une case<span className="orange-period">.</span>
            </>
          }
          description="Un cours pour comprendre. Un parcours pour avancer. Du primaire au lycée, prenez le savoir en main."
          action={{ to: '/catalogue', label: 'Je trouve mon cours' }}
          secondaryAction={{ to: '/parcours', label: 'Explorer les parcours' }}
        >
          <img
            className="campaign-photo"
            src="/img/learning-campaign.png"
            alt="Trois jeunes adultes travaillent ensemble autour d’un ordinateur"
            fetchPriority="high"
          />
          <div className="campaign-stamp">
            <span>LE SAVOIR</span>
            <strong>
              ça se
              <br />
              partage.
            </strong>
            <ArrowUpRight size={30} />
          </div>
          <div className="campaign-caption">
            <span>APPRENDRE ENSEMBLE</span>
            <span>ALLER PLUS LOIN ↗</span>
          </div>
        </EditorialBanner>
      </div>
      <div className="home-beliefs container">
        <span>
          <BookOpen size={18} />
          Des cours gratuits, sans détour.
        </span>
        <span>
          <Users size={18} />
          Des enseignants qui transmettent.
        </span>
        <span>
          <Compass size={18} />
          Votre rythme. Votre chemin.
        </span>
      </div>
      <section className="discovery-section container">
        <div className="discovery-intro">
          <span className="eyebrow">CHOISISSEZ VOTRE TERRAIN</span>
          <h2>
            La curiosité
            <br />
            fait le reste.
          </h2>
          <p>Quatre univers pour trouver votre prochain déclic.</p>
          <Link className="text-link" to="/catalogue">
            Tous les cours
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="discovery-grid">
          {subjects.map((subject) => {
            const course = courses.find((course) => course.id === subject.courseId);
            return (
              <Link
                className={`discovery-card discovery-${subject.color}`}
                key={subject.name}
                to={`/catalogue?matiere=${encodeURIComponent(subject.name)}`}
              >
                <span className="discovery-number">0{subjects.indexOf(subject) + 1}</span>
                {course && <CourseArt course={course} />}
                <div className="discovery-title">
                  <h3>{subject.name}</h3>
                  <ArrowUpRight size={22} />
                </div>
                <p>{subject.line}</p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="home-course-section section container">
        <SectionHeading
          eyebrow="À METTRE DANS VOTRE SAC"
          title="Les cours à découvrir"
          description="Des explications claires. Des notions qui restent."
          link={{ to: '/catalogue', label: 'Tout le catalogue' }}
        />
        {loading ? (
          <p role="status">Chargement des cours…</p>
        ) : (
          <CourseGrid courses={courses.slice(0, 4)} />
        )}
      </section>
      <div className="ambition-wrap container">
        <EditorialBanner
          tone="dark"
          eyebrow="ON NE PRÉPARE PAS DEMAIN EN ATTENDANT"
          title={
            <>
              Préparez la suite.
              <br />
              <em>Dès maintenant.</em>
            </>
          }
          description="Un examen en vue ? Des bases à consolider ? Assemblez les bonnes compétences avec des parcours qui ont un cap."
          action={{ to: '/parcours', label: 'Trouver mon parcours' }}
        >
          <div className="ambition-collage" aria-hidden="true">
            <div className="ambition-slab slab-blue">
              <span>01</span>
              <MoveUpRight size={100} />
              <b>COMPRENDRE</b>
            </div>
            <div className="ambition-slab slab-photo">
              <img src="/img/learning-campaign.png" alt="" loading="lazy" />
              <b>ENSEMBLE</b>
            </div>
            <div className="ambition-slab slab-orange">
              <span>
                À VOUS
                <br />
                DE JOUER.
              </span>
              <div className="orbit-symbol" />
              <b>AVANCER</b>
            </div>
          </div>
        </EditorialBanner>
        <div className="ambition-benefits">
          <span>
            <Check size={16} />
            Des cours regroupés par objectif
          </span>
          <span>
            <Check size={16} />
            Une progression visible
          </span>
          <span>
            <Check size={16} />
            Un accès libre, du début à la fin
          </span>
        </div>
      </div>
      <section className="audience-section container">
        <SectionHeading
          eyebrow="À CHACUN SA FAÇON D’APPRENDRE"
          title="Un point de départ. Plusieurs chemins."
        />
        <div className="audience-grid">
          <Link className="audience-card audience-student" to="/catalogue">
            <span className="eyebrow">JE SUIS ÉLÈVE</span>
            <h3>
              Le cours qui fait
              <br />
              tomber le « j’ai pas compris ».
            </h3>
            <p>
              Revenez sur une notion, préparez votre prochain devoir ou explorez une nouvelle
              matière.
            </p>
            <span className="audience-action">
              Trouver une ressource
              <ArrowUpRight size={23} />
            </span>
          </Link>
          <Link className="audience-card audience-path" to="/parcours">
            <span className="eyebrow">J’AI UN OBJECTIF</span>
            <h3>
              Moins d’hésitation.
              <br />
              Plus de direction.
            </h3>
            <p>Des cours complémentaires, réunis pour avancer avec méthode et garder le fil.</p>
            <span className="audience-action">
              Choisir un parcours
              <ArrowUpRight size={23} />
            </span>
          </Link>
        </div>
      </section>
      <section className="manifesto">
        <div className="container manifesto-inner">
          <div className="manifesto-mark" aria-hidden="true">
            a<span>→</span>z
          </div>
          <div>
            <span className="eyebrow">NOTRE CONVICTION</span>
            <h2>
              Le talent est partout.
              <br />
              Donnons-lui de la place.
            </h2>
            <p>
              Du primaire au lycée, un savoir partagé peut changer une trajectoire. EduTube est
              pensé pour rendre les ressources pédagogiques plus accessibles au Sénégal.
            </p>
            <Link className="text-link" to="/a-propos">
              L’histoire que l’on veut écrire
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
