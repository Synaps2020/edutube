import { useAuth } from '../auth-context';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Clock3, BookOpen, Check, Flag } from 'lucide-react';
import { useLearning } from '../context';
import { progress } from '../../domain/course';
import { ButtonLink, EmptyState, CourseArt } from '../components/primitives';
import { CourseRow, PageIntro, ProgressBar } from '../components/learning-ui';
export function Paths() {
  const { paths, courses } = useLearning();
  return (
    <>
      <PageIntro
        eyebrow="UNE DIRECTION, PAS UNE LISTE DE COURS"
        title="Choisissez votre prochain cap."
        description="Des étapes dans le bon ordre. Des objectifs à portée de main."
      >
        <div className="intro-ticket">
          <Flag size={28} />
          <b>3 parcours</b>
          <span>Du premier pas à la mise en pratique</span>
        </div>
      </PageIntro>
      <section className="container route-collection">
        {paths.map((path, index) => {
          const first = courses.find((course) => course.id === path.courseIds[0]);
          return (
            <article className={`route-feature route-tone-${index}`} key={path.id}>
              <div className="route-illustration">
                {first && <CourseArt course={first} />}
                <span>PARCOURS 0{index + 1}</span>
              </div>
              <div className="route-description">
                <span className="eyebrow">
                  {index === 0
                    ? 'OBJECTIF EXAMEN'
                    : index === 1
                      ? 'OBJECTIF DÉCOUVERTE'
                      : 'OBJECTIF CONFIANCE'}
                </span>
                <h2>{path.title}</h2>
                <p>{path.description}</p>
                <div className="route-meta">
                  <span>
                    <BookOpen size={16} />
                    {path.courseIds.length} cours
                  </span>
                  <span>
                    <Clock3 size={16} />
                    {path.duration}
                  </span>
                </div>
                <div className="route-preview">
                  {path.courseIds.map((id, index) => (
                    <span key={id}>
                      <b>{index + 1}</b>
                      {courses.find((course) => course.id === id)?.subject}
                    </span>
                  ))}
                </div>
                <ButtonLink to={`/parcours/${path.id}`}>
                  Voir les étapes
                  <ArrowRight size={17} />
                </ButtonLink>
              </div>
            </article>
          );
        })}
      </section>
      <section className="container route-help">
        <h2>Vous préférez choisir vous-même ?</h2>
        <p>Une matière, un chapitre, une difficulté : le catalogue s’adapte à votre recherche.</p>
        <ButtonLink secondary to="/catalogue">
          Composer mon chemin
          <ArrowRight size={17} />
        </ButtonLink>
      </section>
    </>
  );
}
export function PathDetail() {
  const { session } = useAuth();
  const { id } = useParams();
  const { paths, courses, enrollments, joinPath, loading, busy } = useLearning();
  const path = paths.find((path) => path.id === id);
  if (loading) {
    return <p className="container section">Chargement…</p>;
  }
  if (!path) {
    return (
      <EmptyState
        title="Parcours introuvable"
        description="Choisissez un objectif parmi nos parcours."
      >
        <ButtonLink to="/parcours">Voir les parcours</ButtonLink>
      </EmptyState>
    );
  }
  const ordered = path.courseIds
    .map((id) => courses.find((course) => course.id === id))
    .filter((course): course is NonNullable<typeof course> => !!course);
  const percent = ordered.length
    ? Math.round(
        ordered.reduce(
          (sum, course) =>
            sum +
            progress(
              course,
              enrollments.find((enrollment) => enrollment.courseId === course.id),
            ),
          0,
        ) / ordered.length,
      )
    : 0;
  const next =
    ordered.find(
      (course) =>
        progress(
          course,
          enrollments.find((enrollment) => enrollment.courseId === course.id),
        ) < 100,
    ) ?? ordered[0];
  const nextLessonId =
    enrollments.find((enrollment) => enrollment.courseId === next?.id)?.nextLessonId ?? '';
  const joined = ordered.every((course) =>
    enrollments.some((enrollment) => enrollment.courseId === course.id),
  );
  return (
    <>
      <PageIntro eyebrow="PARCOURS GUIDÉ" title={path.title} description={path.description}>
        <div className="intro-ticket">
          <Flag size={28} />
          <b>{path.duration}</b>
          <span>{ordered.length} étapes pour avancer</span>
        </div>
      </PageIntro>
      <div className="container path-detail-layout">
        <section>
          <Link className="text-link" to="/parcours">
            ← Tous les parcours
          </Link>
          <h2 className="spaced-heading">Votre feuille de route</h2>
          <p className="muted">
            L’ordre proposé vous aide à construire vos connaissances progressivement.
          </p>
          {ordered.map((course, index) => (
            <CourseRow
              key={course.id}
              course={course}
              index={index}
              completed={
                progress(
                  course,
                  enrollments.find((enrollment) => enrollment.courseId === course.id),
                ) === 100
              }
            />
          ))}
          <div className="path-finish">
            <Check size={24} />
            <div>
              <h3>Faire le point sur vos acquis</h3>
              <p>
                À chaque cours, un quiz corrigé pour identifier ce que vous comprenez et ce qu’il
                faut revoir.
              </p>
            </div>
          </div>
        </section>
        <aside className="path-enroll panel">
          <span className="eyebrow">VOTRE CAP</span>
          <h2>{percent}%</h2>
          <ProgressBar value={percent} label="Progression du parcours" />
          <p>
            {percent === 100
              ? 'Vous avez parcouru toutes les étapes.'
              : 'Chaque chapitre terminé fait avancer votre parcours.'}
          </p>
          {!joined ? (
            <button
              className="button"
              disabled={!!busy}
              onClick={() => {
                if (session) {
                  void joinPath(path.id);
                } else {
                  window.location.assign(
                    `/connexion?retour=${encodeURIComponent(`/parcours/${path.id}`)}`,
                  );
                }
              }}
            >
              {busy === `path:${path.id}` ? 'Ajout en cours…' : 'Ajouter le parcours'}
            </button>
          ) : (
            next && (
              <ButtonLink to={`/apprendre/${next.id}/${nextLessonId}`}>
                {percent === 100 ? 'Revoir le parcours' : 'Continuer le parcours'}
                <ArrowRight size={16} />
              </ButtonLink>
            )
          )}
          <span className="small-label">Gratuit · Progression enregistrée dans votre compte</span>
        </aside>
      </div>
    </>
  );
}
