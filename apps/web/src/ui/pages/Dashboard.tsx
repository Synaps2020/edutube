import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, ArrowRight, Bookmark, FileText, ListChecks } from 'lucide-react';
import { useLearning } from '../context';
import { useStudy } from '../study-context';
import { progress } from '../../domain/course';
import { ButtonLink, CourseArt, CourseGrid, EmptyState } from '../components/primitives';
import { LegacyImport } from '../components/LegacyImport';
import { PageIntro, ProgressBar } from '../components/learning-ui';
const tabs = [
  { id: 'cours', label: 'Mes cours', icon: BookOpen },
  { id: 'favoris', label: 'Pour plus tard', icon: Bookmark },
  { id: 'notes', label: 'Mes notes', icon: FileText },
  { id: 'bilan', label: 'Mon bilan', icon: ListChecks },
];
export function Dashboard() {
  const { courses, enrollments, loading: learningLoading } = useLearning();
  const { state, noteEntries, noteStatus, loading: studyLoading } = useStudy();
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((item) => item.id === params.get('onglet'))
    ? params.get('onglet')!
    : 'cours';
  const joined = courses.filter((course) =>
    enrollments.some((enrollment) => enrollment.courseId === course.id),
  );
  const completed = joined.filter(
    (course) =>
      progress(
        course,
        enrollments.find((enrollment) => enrollment.courseId === course.id),
      ) === 100,
  );
  const saved = courses.filter((course) => state.favorites.includes(course.id));
  const notes = noteEntries
    .filter((entry) => (state.notes[entry.lessonId] ?? entry.text).trim())
    .map((entry) => ({
      course: { id: entry.courseId, subject: entry.subject.name },
      lesson: { id: entry.lessonId, title: entry.lessonTitle },
      text: state.notes[entry.lessonId] ?? entry.text,
    }));
  const lastCourse = courses.find((course) => course.id === state.lastLesson?.courseId);
  const lastEntry = noteEntries.find((entry) => entry.lessonId === state.lastLesson?.lessonId);
  const last = state.lastLesson
    ? {
        id: state.lastLesson.lessonId,
        title: lastEntry?.lessonTitle ?? 'Retrouver votre dernier chapitre',
      }
    : undefined;
  if (learningLoading || studyLoading) {
    return (
      <p className="container section" role="status">
        Chargement de votre espace…
      </p>
    );
  }
  return (
    <>
      <PageIntro
        eyebrow="VOTRE COIN POUR AVANCER"
        title="On reprend là où vous en étiez ?"
        description="Vos cours, vos idées et vos prochains objectifs, au même endroit."
      >
        <div className="intro-ticket">
          <CheckCircle2 size={27} />
          <b>
            {completed.length} cours terminé{completed.length > 1 ? 's' : ''}
          </b>
          <span>La progression vous appartient.</span>
        </div>
      </PageIntro>
      <div className="container dashboard-layout">
        <aside className="workspace-nav">
          <span className="eyebrow">MON APPRENTISSAGE</span>
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setParams({ onglet: item.id })}
              aria-pressed={tab === item.id}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === 'favoris' && <b>{saved.length}</b>}
            </button>
          ))}
          <div className="workspace-local">
            <span>VOTRE ESPACE PERSONNEL</span>
            <p>Vos cours et vos notes vous suivent sur vos appareils.</p>
          </div>
        </aside>
        <section className="workspace-body">
          <LegacyImport />
          {tab === 'cours' && (
            <>
              {lastCourse && last && (
                <div className="resume-banner">
                  <div>
                    <span className="eyebrow">VOTRE DERNIÈRE ÉTAPE</span>
                    <h2>{lastCourse.title}</h2>
                    <p>{last.title}</p>
                    <ButtonLink to={`/apprendre/${lastCourse.id}/${last.id}`}>
                      Reprendre ici
                      <ArrowRight size={17} />
                    </ButtonLink>
                  </div>
                  <CourseArt course={lastCourse} />
                </div>
              )}
              <div className="workspace-heading">
                <h2>Mes cours</h2>
                <span>{joined.length} dans votre bibliothèque</span>
              </div>
              {!joined.length ? (
                <EmptyState
                  title="Votre premier cours vous attend"
                  description="Choisissez un sujet, ajoutez le cours et commencez avec une fiche ou un quiz."
                >
                  <ButtonLink to="/catalogue">Explorer le catalogue</ButtonLink>
                </EmptyState>
              ) : (
                <div className="learning-grid">
                  {joined.map((course) => {
                    const enrollment = enrollments.find(
                      (enrollment) => enrollment.courseId === course.id,
                    );
                    const percent = progress(course, enrollment);
                    const next = { id: enrollment?.nextLessonId ?? '' };
                    return (
                      <article className="learning-card" key={course.id}>
                        <CourseArt course={course} />
                        <div>
                          <span className="eyebrow">{course.subject}</span>
                          <h2>{course.title}</h2>
                          <ProgressBar value={percent} />
                          <div className="learning-progress">
                            <span>{percent}% terminé</span>
                            <span>
                              {enrollment?.completedLessonIds.length ?? 0} / {course.lessonCount}{' '}
                              chapitres
                            </span>
                          </div>
                          <ButtonLink to={`/apprendre/${course.id}/${next.id}`}>
                            {percent === 100 ? 'Revoir' : 'Continuer'}
                            <ArrowRight size={16} />
                          </ButtonLink>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {tab === 'favoris' && (
            <>
              <div className="workspace-heading">
                <h2>À découvrir plus tard</h2>
                <span>
                  {saved.length} cours enregistré{saved.length > 1 ? 's' : ''}
                </span>
              </div>
              {saved.length ? (
                <CourseGrid courses={saved} />
              ) : (
                <EmptyState
                  title="Gardez vos prochaines découvertes"
                  description="Utilisez le marque-page d’un cours pour le retrouver ici."
                >
                  <ButtonLink to="/catalogue">Trouver un cours</ButtonLink>
                </EmptyState>
              )}
            </>
          )}
          {tab === 'notes' && (
            <>
              <div className="workspace-heading">
                <h2>Votre carnet d’apprentissage</h2>
                <span>
                  {notes.length} note{notes.length > 1 ? 's' : ''}
                </span>
              </div>
              {notes.length ? (
                <div className="notes-collection">
                  {notes.map((note) => (
                    <article key={note.lesson.id}>
                      <span className="eyebrow">{note.course.subject}</span>
                      <h3>{note.lesson.title}</h3>
                      <p>{note.text}</p>
                      {noteStatus[note.lesson.id] &&
                        noteStatus[note.lesson.id].status !== 'saved' && (
                          <p role="status" className="muted">
                            {noteStatus[note.lesson.id].status === 'conflict' ||
                            noteStatus[note.lesson.id].status === 'error'
                              ? 'Cette modification n’est pas encore enregistrée. Revenez au chapitre pour la reprendre.'
                              : 'Enregistrement en cours…'}
                          </p>
                        )}
                      <Link
                        className="text-link"
                        to={`/apprendre/${note.course.id}/${note.lesson.id}`}
                      >
                        Revenir au chapitre
                        <ArrowRight size={16} />
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Une idée à retenir ? Notez-la."
                  description="Dans un chapitre, ouvrez « Mes notes ». Votre carnet se remplira ici."
                />
              )}
            </>
          )}
          {tab === 'bilan' && (
            <>
              <div className="workspace-heading">
                <h2>Des progrès, à votre rythme.</h2>
              </div>
              <div className="dashboard-stats">
                <div>
                  <BookOpen />
                  <b>{joined.length}</b>
                  <span>Cours ajoutés</span>
                </div>
                <div>
                  <CheckCircle2 />
                  <b>{completed.length}</b>
                  <span>Cours terminés</span>
                </div>
                <div>
                  <ListChecks />
                  <b>
                    {
                      Object.keys(state.quizScores).filter((id) =>
                        courses.some((course) => course.id === id),
                      ).length
                    }
                  </b>
                  <span>Quiz essayés</span>
                </div>
              </div>
              <h3>Mes derniers résultats</h3>
              <p className="muted">
                Ces scores sont des auto-évaluations de démonstration, sans certification.
              </p>
              {courses
                .filter((course) => state.quizScores[course.id] !== undefined)
                .map((course) => (
                  <div className="score-row" key={course.id}>
                    <div>
                      <h3>{course.title}</h3>
                      <Link className="text-link" to={`/apprendre/${course.id}`}>
                        Revoir les notions
                      </Link>
                    </div>
                    <strong>{state.quizScores[course.id]}%</strong>
                  </div>
                ))}
              {!Object.keys(state.quizScores).length && (
                <EmptyState
                  title="Faites le point sur une notion"
                  description="Les quiz dans la salle de cours vous donnent une correction immédiate."
                />
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
