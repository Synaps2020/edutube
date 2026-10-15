import { LessonVideo } from '../components/LessonVideo';
import { videoService } from '../../adapters/http/videos';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Check,
  Clock3,
  Star,
  BookOpen,
  ChevronDown,
  Play,
  ArrowRight,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { api } from '../../adapters/http/runtime';
import type { LessonContentDto } from '@edutube/contracts';
import { useAuth } from '../auth-context';
import { useLearning, useCourse } from '../context';
import { useStudy } from '../study-context';
import { progress } from '../../domain/course';
import {
  ButtonLink,
  CourseArt,
  EmptyState,
  CourseGrid,
  SectionHeading,
} from '../components/primitives';
import { FavoriteButton, ProgressBar } from '../components/learning-ui';
import { StudyTools, CourseQuiz } from '../components/StudyTools';
export function CoursePage() {
  const { id } = useParams();
  const { courses, enrollments, join, busy } = useLearning();
  const { course, loading, error } = useCourse(id);
  const { session } = useAuth();
  const { state } = useStudy();

  if (loading) {
    return <p className="container section">Chargement…</p>;
  }
  if (!course) {
    return (
      <EmptyState
        title="Ce cours n’existe pas"
        description={error || 'Retrouvez nos ressources dans le catalogue.'}
      >
        <ButtonLink to="/catalogue">Explorer les cours</ButtonLink>
      </EmptyState>
    );
  }
  const enrollment = enrollments.find((enrollment) => enrollment.courseId === id);
  const remembered =
    state.lastLesson?.courseId === id
      ? course.lessons.find((lesson) => lesson.id === state.lastLesson?.lessonId)
      : undefined;
  const next =
    remembered ??
    course.lessons.find((lesson) => !enrollment?.completedLessonIds.includes(lesson.id)) ??
    course.lessons[0];
  return (
    <>
      <section className={`course-detail-hero course-tone-${course.color}`}>
        <div className="container course-detail-head">
          <div>
            <div className="breadcrumbs">
              <Link to="/catalogue">Catalogue</Link>
              <span>/</span>
              <Link to={`/catalogue?matiere=${encodeURIComponent(course.subject)}`}>
                {course.subject}
              </Link>
            </div>
            <span className="eyebrow">
              {course.subject} · {course.level}
            </span>
            <h1>{course.title}</h1>
            <p>{course.description}</p>
            <div className="course-summary">
              <span>
                <Star size={16} fill="currentColor" />
                {course.rating ?? 'Nouveau'} · {course.learners.toLocaleString('fr-FR')} apprenants
              </span>
              <span>
                <Clock3 size={16} />
                {course.duration}
              </span>
            </div>
            <div className="course-author-line">
              <span className="teacher-avatar">
                {course.teacher
                  .split(' ')
                  .map((name) => name[0])
                  .join('')}
              </span>
              <div>
                Avec <strong>{course.teacher}</strong>
                <small>Présentation du cours</small>
              </div>
            </div>
          </div>
          <div className="course-hero-art">
            <CourseArt course={course} large />
            <span>COMPRENDRE CHANGE TOUT ↗</span>
          </div>
        </div>
      </section>
      <div className="container course-detail-layout">
        <div>
          <nav className="course-anchor-nav" aria-label="Dans ce cours">
            <a href="#objectifs">Objectifs</a>
            <a href="#programme">Programme</a>
            <a href="#prerequis">Prérequis</a>
            <a href="#enseignant">Enseignant</a>
          </nav>
          <section className="outcomes panel" id="objectifs">
            <span className="eyebrow">CE QUE VOUS EMPORTEZ</span>
            <h2>À la fin de ce cours, vous saurez…</h2>
            {course.outcomes.map((outcome) => (
              <p key={outcome}>
                <Check size={20} />
                {outcome}
              </p>
            ))}
          </section>
          <section className="course-includes">
            <span>
              <BookOpen />
              {course.lessons.length} chapitres guidés
            </span>
            <span>
              <FileText />
              Documents selon les chapitres
            </span>
            <span>
              <Check />
              Des exercices pour pratiquer
            </span>
          </section>
          <section id="programme">
            <SectionHeading
              title="Le programme"
              description="Comprendre, s’entraîner, puis passer à la suite."
            />
            <div className="curriculum">
              {course.lessons.map((lesson, index) => (
                <details key={lesson.id} open={index === 0}>
                  <summary>
                    <span>
                      <b>{String(index + 1).padStart(2, '0')}</b>
                      {lesson.title}
                    </span>
                    <span>
                      {lesson.minutes} min
                      <ChevronDown size={16} />
                    </span>
                  </summary>
                  <div className="curriculum-preview">
                    <p>
                      {index === 0
                        ? course.material.summary
                        : 'Une étape pour approfondir les objectifs du cours, avec fiche de révision et entraînement.'}
                    </p>
                    <Link className="text-link" to={`/apprendre/${course.id}/${lesson.id}`}>
                      {index === 0 ? 'Découvrir le chapitre' : 'Ouvrir le chapitre'}
                      <Play size={14} />
                    </Link>
                  </div>
                </details>
              ))}
            </div>
          </section>
          <section className="prerequisite-panel" id="prerequis">
            <h2>Avant de commencer</h2>
            <ul>
              {course.material.prerequisites.map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
            <p>
              Un cahier et quelques minutes au calme suffisent pour profiter des fiches et
              exercices.
            </p>
          </section>
          <section className="teacher-panel" id="enseignant">
            <div className="teacher-avatar">
              {course.teacher
                .split(' ')
                .map((name) => name[0])
                .join('')}
            </div>
            <div>
              <span className="eyebrow">VOTRE ENSEIGNANT</span>
              <h3>{course.teacher}</h3>
              <p>
                {course.teacherBiography || 'Cet enseignant vous accompagne tout au long du cours.'}
              </p>
            </div>
          </section>
        </div>
        <aside className="enrollment-card">
          <CourseArt course={course} />
          <div className="enrollment-body">
            <span className="eyebrow">LE SAVOIR EST POUR TOUS</span>
            <h2>Gratuit. Vraiment.</h2>
            <p>Un cours à votre rythme, avec vos notes et votre progression.</p>
            {enrollment ? (
              <ButtonLink to={`/apprendre/${course.id}/${next.id}`}>
                {progress(course, enrollment) === 100 ? 'Revoir le cours' : 'Reprendre mon cours'}
                <ArrowRight size={17} />
              </ButtonLink>
            ) : (
              <button
                className="button"
                disabled={!!busy}
                onClick={() => {
                  if (session) {
                    join(course.id);
                  } else {
                    window.location.assign(
                      `/connexion?retour=${encodeURIComponent(`/cours/${course.id}`)}`,
                    );
                  }
                }}
              >
                {busy === `course:${course.id}` ? 'Ajout en cours…' : 'Commencer ce cours'}
                <ArrowRight size={17} />
              </button>
            )}
            <FavoriteButton courseId={course.id} />
            {enrollment && (
              <div className="enrollment-progress">
                <ProgressBar value={progress(course, enrollment)} />
                <p role="status">{progress(course, enrollment)}% terminé</p>
              </div>
            )}
            <ul>
              <li>
                <Check size={16} />
                Leçons et notes accessibles immédiatement
              </li>
              <li>
                <Check size={16} />
                Notes privées dans votre compte
              </li>
              <li>
                <Check size={16} />
                Aucun paiement nécessaire
              </li>
            </ul>
            <p className="demo-note">
              Les vidéos sont lues au fil de votre connexion. Les chapitres protégés se débloquent
              après la réussite de l’examen.
            </p>
          </div>
        </aside>
      </div>
      <section className="container section related-courses">
        <SectionHeading
          title="Pour aller plus loin"
          link={{ to: '/catalogue', label: 'Tous les cours' }}
        />
        <CourseGrid courses={courses.filter((course) => course.id !== id).slice(0, 3)} />
      </section>
    </>
  );
}
export function Classroom() {
  const { id, lessonId } = useParams();
  const { enrollments, complete, busy } = useLearning();
  const { course, loading } = useCourse(id);
  const { session } = useAuth();
  const [content, setContent] = useState<LessonContentDto | null>(null);
  const [contentError, setContentError] = useState('');
  const { visit } = useStudy();
  const [access, setAccess] = useState<Awaited<ReturnType<typeof videoService.access>> | null>(
    null,
  );
  const [accessError, setAccessError] = useState('');
  const [accessRefresh, setAccessRefresh] = useState(0);
  const [ended, setEnded] = useState(false);
  const refreshAccess = () => setAccessRefresh((value) => value + 1);
  const lesson = course?.lessons.find((lesson) => lesson.id === lessonId) ?? course?.lessons[0];
  const chapterLocked = access?.lessons.find((item) => item.id === lesson?.id)?.locked ?? true;
  useEffect(() => {
    if (!id) {
      return;
    }
    const controller = new AbortController();
    setAccessError('');
    videoService
      .access(id, controller.signal)
      .then(setAccess)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setAccessError(failure instanceof Error ? failure.message : 'Accès indisponible.');
        }
      });
    return () => controller.abort();
  }, [id, session?.learner.id, accessRefresh]);

  useEffect(() => {
    if (
      course &&
      lesson &&
      access &&
      !access.lessons.find((item) => item.id === lesson.id)?.locked
    ) {
      visit(course.id, lesson.id);
    }
  }, [course, lesson, visit, access]);
  useEffect(() => {
    const controller = new AbortController();
    setContent(null);
    setEnded(false);
    setContentError('');
    if (course && lesson && !chapterLocked) {
      api.lessons
        .get(course.id, lesson.id, { signal: controller.signal })
        .then(setContent)
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) {
            setContentError(failure instanceof Error ? failure.message : 'Chapitre indisponible.');
          }
        });
    }
    return () => controller.abort();
  }, [course, lesson, session?.learner.id, chapterLocked]);
  if (loading) {
    return <p className="container section">Chargement…</p>;
  }
  if (!course || !lesson) {
    return (
      <EmptyState title="Cours introuvable" description="Choisissez un cours dans le catalogue.">
        <ButtonLink to="/catalogue">Catalogue</ButtonLink>
      </EmptyState>
    );
  }
  const enrollment = enrollments.find((enrollment) => enrollment.courseId === id);
  const percent = progress(course, enrollment);
  const done = enrollment?.completedLessonIds.includes(lesson.id);
  const index = course.lessons.findIndex((chapter) => chapter.id === lesson.id);
  const next = course.lessons[index + 1];
  const previous = course.lessons[index - 1];
  const locked = access?.lessons.find((item) => item.id === lesson.id)?.locked ?? true;
  const nextLocked = next && access?.lessons.find((item) => item.id === next.id)?.locked;
  return (
    <div className="classroom-page">
      <div className="classroom-topbar container">
        <Link to={`/cours/${id}`}>
          <ArrowLeft size={17} />
          <span>{course.title}</span>
        </Link>
        <span>
          Chapitre {index + 1} / {course.lessons.length}
        </span>
      </div>
      <section className="container classroom-workspace">
        <div>
          <div className="lesson-heading">
            <div>
              <span className="eyebrow">
                {course.subject} · {course.level}
              </span>
              <h1>{lesson.title}</h1>
            </div>
            <span>
              <Clock3 size={16} />
              {lesson.minutes} min
            </span>
          </div>
          {accessError ? (
            <p role="alert">{accessError}</p>
          ) : !access ? (
            <p role="status">Vérification des chapitres accessibles…</p>
          ) : locked ? (
            <div className="exam-lock">
              <h2>Un examen avant de poursuivre.</h2>
              <p>
                Obtenez au moins {access.passingScore}% au quiz du cours pour débloquer ce chapitre
                et les suivants.
              </p>
              <CourseQuiz
                course={course}
                passingScore={access.passingScore}
                onAttempt={refreshAccess}
              />
            </div>
          ) : (
            <>
              {lesson.kind === 'VIDEO' && (
                <LessonVideo
                  key={`video-${lesson.id}`}
                  courseId={course.id}
                  lessonId={lesson.id}
                  title={lesson.title}
                  onEnded={() => setEnded(true)}
                />
              )}
              {ended && (
                <p className="video-finished" role="status">
                  Vidéo terminée. Marquez ce chapitre comme terminé puis poursuivez votre parcours.
                </p>
              )}
              {contentError ? (
                <p role="alert">{contentError}</p>
              ) : !content ? (
                <p role="status">Chargement du chapitre…</p>
              ) : (
                <StudyTools
                  resources={content.resources}
                  onAttempt={refreshAccess}
                  examScore={
                    access.lessons.some((item) => item.requiresQuiz)
                      ? access.passingScore
                      : undefined
                  }
                  key={`tools-${lesson.id}`}
                  course={{
                    ...course,
                    material: {
                      ...course.material,
                      summary: content.blocks
                        .filter((block) => block.type === 'PARAGRAPH')
                        .map((block) => block.text)
                        .join('\n'),
                      example: content.blocks.find((block) => block.type === 'EXAMPLE')?.text ?? '',
                    },
                  }}
                  lessonId={lesson.id}
                />
              )}
            </>
          )}
          <div className="lesson-actions">
            <button
              className={`button ${done ? 'button-secondary' : ''}`}
              disabled={done || locked || !!accessError || !content || !!contentError || !!busy}
              onClick={() => complete(course, lesson.id)}
            >
              {done ? (
                <>
                  <Check size={17} />
                  Chapitre terminé
                </>
              ) : (
                'Marquer comme terminé'
              )}
            </button>
            <div>
              {previous && (
                <ButtonLink secondary to={`/apprendre/${id}/${previous.id}`}>
                  <ArrowLeft size={16} />
                  Précédent
                </ButtonLink>
              )}
              {nextLocked ? (
                <button className="button" disabled>
                  Réussir l’examen pour continuer
                </button>
              ) : next ? (
                <ButtonLink to={`/apprendre/${id}/${next.id}`}>
                  Suivant
                  <ArrowRight size={16} />
                </ButtonLink>
              ) : (
                <ButtonLink to="/mon-espace">
                  Mon bilan
                  <ArrowRight size={16} />
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
        <aside className="lesson-sidebar">
          <div className="sidebar-progress">
            <span className="eyebrow">VOTRE PROGRESSION</span>
            <strong>{percent}%</strong>
            <ProgressBar value={percent} />
            <p>
              {enrollment?.completedLessonIds.length ?? 0} / {course.lessons.length} chapitres
            </p>
          </div>
          <h2>Au programme</h2>
          {course.lessons.map((chapter, index) =>
            access?.lessons.find((item) => item.id === chapter.id)?.locked ? (
              <div className="chapter-locked" key={chapter.id}>
                <span>🔒</span>
                <div>
                  {chapter.title}
                  <small>Examen requis</small>
                </div>
              </div>
            ) : (
              <Link
                className={chapter.id === lesson.id ? 'active' : ''}
                to={`/apprendre/${id}/${chapter.id}`}
                key={chapter.id}
              >
                <span>
                  {enrollment?.completedLessonIds.includes(chapter.id) ? (
                    <Check size={18} />
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </span>
                <div>
                  {chapter.title}
                  <small>{chapter.minutes} min</small>
                </div>
              </Link>
            ),
          )}
          <Link className="sidebar-dashboard" to="/mon-espace">
            Retrouver mon espace
            <ArrowRight size={16} />
          </Link>
        </aside>
      </section>
    </div>
  );
}
