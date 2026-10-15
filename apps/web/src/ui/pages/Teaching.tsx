import { CoursePresentation } from '../components/CoursePresentation';
import { ChapterEditor } from '../components/ChapterEditor';
import { QuizEditor } from '../components/QuizEditor';
import { useEffect, useState } from 'react';
import { useConfirmation } from '../confirmation-context';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BookOpen, CheckCircle } from 'lucide-react';
import type { TeachingCourse, TeachingContent, TeachingSummary } from '@edutube/contracts/teaching';
import { teachingService } from '../../adapters/http/teaching';
import { api } from '../../adapters/http/runtime';
import { registerPendingChanges } from '../../application/pending-changes';
import { useAuth } from '../auth-context';
import '../teaching.css';
const labels = { DRAFT: 'Brouillon', PUBLISHED: 'Publié', ARCHIVED: 'Archivé' };
const emptyContent: TeachingContent = {
  title: 'Mon nouveau cours',
  shortDescription: 'Une introduction à votre cours.',
  description: 'Présentez votre cours et ce que les élèves vont découvrir.',
  subjectId: '',
  schoolLevel: 'MIDDLE',
  language: 'fr',
  palette: 'blue',
  illustration: 'geometry',
  outcomes: ['Comprendre les notions essentielles'],
  prerequisites: [],
  lessons: [],
  quiz: null,
};
export function TeachingPage() {
  const confirm = useConfirmation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [courses, setCourses] = useState<TeachingSummary[]>([]);
  const [selected, setSelected] = useState<TeachingCourse | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const allowed = session?.learner.role === 'TEACHER' || session?.learner.role === 'ADMIN';
  useEffect(() => {
    if (!allowed) {
      return;
    }
    let active = true;
    void Promise.all([teachingService.list(), api.catalog.taxonomy()])
      .then(([items, taxonomy]) => {
        if (active) {
          setCourses(items);
          setSubjects(taxonomy.subjects);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFailure(error instanceof Error ? error.message : 'Chargement impossible.');
        }
      });
    return () => {
      active = false;
    };
  }, [allowed]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || busy) {
        event.preventDefault();
      }
    };
    const leave = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!dirty || !anchor || anchor.target === '_blank' || event.ctrlKey || event.metaKey) {
        return;
      }
      if (
        anchor.origin !== window.location.origin ||
        anchor.hasAttribute('download') ||
        (anchor.protocol !== 'http:' && anchor.protocol !== 'https:')
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void confirm({
        title: 'Quitter ce brouillon ?',
        message:
          'Vos changements ne sont pas encore enregistrés. Vous pouvez annuler et les sauvegarder.',
        confirmLabel: 'Quitter sans enregistrer',
      }).then((accepted) => {
        if (accepted) {
          setDirty(false);
          navigate(anchor.pathname + anchor.search + anchor.hash);
        }
      });
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', leave, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', leave, true);
    };
  }, [dirty, busy, confirm, navigate]);
  useEffect(
    () =>
      registerPendingChanges(async () => {
        if (dirty) {
          throw new Error('Enregistrez votre brouillon enseignant avant de vous déconnecter.');
        }
        if (busy) {
          throw new Error('Attendez la fin de l’enregistrement avant de vous déconnecter.');
        }
      }),
    [dirty, busy],
  );
  if (!allowed) {
    return (
      <section className="container section">
        <h1>L’espace enseignant</h1>
        <p>
          Votre compte ne dispose pas encore d’un accès enseignant. Contactez le responsable de la
          plateforme.
        </p>
        <Link to="/mon-espace">Retour à mon apprentissage</Link>
      </section>
    );
  }
  const change = (patch: Partial<TeachingCourse>) => {
    if (selected) {
      setSelected({ ...selected, ...patch });
      setDirty(true);
      setMessage('');
    }
  };
  const run = async (
    action: () => Promise<TeachingCourse>,
    success = 'Vos changements sont enregistrés.',
  ) => {
    setBusy(true);
    setFailure('');
    setMessage('');
    try {
      const course = await action();
      setSelected(course);
      setDirty(false);
      setCourses((items) => [
        { ...course, lessonCount: course.lessons.length },
        ...items.filter((item) => item.id !== course.id),
      ]);
      setMessage(success);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };
  const mutateDocuments = async (action: () => Promise<unknown>) => {
    if (!selected || dirty || busy) {
      return false;
    }
    let succeeded = false;
    await run(async () => {
      await action();
      const course = await teachingService.get(selected.id);
      succeeded = true;
      return course;
    }, 'Les médias du chapitre sont à jour.');
    return succeeded;
  };
  const open = async (course: TeachingSummary) => {
    if (
      dirty &&
      !(await confirm({
        title: 'Ouvrir un autre cours ?',
        message: 'Les changements du brouillon actuel seront abandonnés.',
        confirmLabel: 'Ouvrir le cours',
      }))
    ) {
      return;
    }
    void run(() => teachingService.get(course.id), '');
  };
  return (
    <>
      <section className="teacher-hero">
        <div className="container">
          <span className="eyebrow">LE SAVOIR SE TRANSMET</span>
          <h1>Vos idées deviennent des cours.</h1>
          <p>Préparez, structurez et partagez votre prochaine leçon.</p>
        </div>
      </section>
      <div className="container teacher-workspace">
        <aside className="teacher-sidebar">
          <h2>
            Mes cours <span>{courses.length}</span>
          </h2>
          <button
            className="button primary"
            disabled={busy || !subjects.length || dirty}
            onClick={() =>
              void run(() => teachingService.create({ ...emptyContent, subjectId: subjects[0].id }))
            }
          >
            <Plus size={17} /> Nouveau cours
          </button>
          {courses.map((course) => (
            <button
              disabled={busy}
              className={selected?.id === course.id ? 'teacher-course active' : 'teacher-course'}
              key={course.id}
              onClick={() => void open(course)}
            >
              <BookOpen size={18} />
              <span>
                <strong>{course.title}</strong>
                <small>
                  {labels[course.status]} · {course.lessonCount} chapitres
                </small>
              </span>
            </button>
          ))}
        </aside>
        <section className="teacher-editor">
          {failure && (
            <p role="alert" className="notice">
              {failure}
            </p>
          )}
          {message && (
            <p role="status" className="teacher-success">
              <CheckCircle size={18} />
              {message}
            </p>
          )}
          {!selected ? (
            <div className="teacher-welcome">
              <BookOpen size={42} />
              <h2>Un bon cours commence par une idée claire.</h2>
              <p>Créez votre premier brouillon ou ouvrez un cours pour préparer son contenu.</p>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => teachingService.save(selected));
              }}
            >
              <header className="teacher-editor-head">
                <div>
                  <span className="eyebrow">{labels[selected.status]}</span>
                  <h2>{selected.title}</h2>
                </div>
                <span>{dirty ? 'Modifications non enregistrées' : 'À jour'}</span>
              </header>
              {selected.status !== 'DRAFT' && (
                <p className="notice">
                  Pour modifier ce cours, remettez-le en brouillon. Il sera retiré du catalogue
                  pendant vos changements.
                </p>
              )}
              <fieldset>
                <CoursePresentation
                  disabled={busy || selected.status !== 'DRAFT'}
                  selected={selected}
                  change={change}
                  subjects={subjects}
                />
                <ChapterEditor
                  disabled={busy || selected.status !== 'DRAFT'}
                  selected={selected}
                  change={change}
                  documentsEnabled={!dirty && selected.status === 'DRAFT'}
                  mutateDocuments={mutateDocuments}
                />
                <QuizEditor
                  disabled={busy || selected.status !== 'DRAFT'}
                  selected={selected}
                  change={change}
                />
                <button
                  className="button primary"
                  type="submit"
                  disabled={!dirty || busy || selected.status !== 'DRAFT'}
                >
                  Enregistrer le brouillon
                </button>
              </fieldset>
              <div className="teacher-publishing">
                <h3>Diffusion du cours</h3>
                <p>
                  {selected.status === 'PUBLISHED'
                    ? 'Votre cours est visible dans le catalogue.'
                    : 'Ce cours est réservé à votre espace.'}
                </p>
                <div>
                  {selected.status === 'DRAFT' && (
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy || dirty || !selected.lessons.length}
                      onClick={() => void run(() => teachingService.status(selected, 'PUBLISHED'))}
                    >
                      Publier le cours
                    </button>
                  )}
                  {selected.status !== 'DRAFT' && (
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => void run(() => teachingService.status(selected, 'DRAFT'))}
                    >
                      Remettre en brouillon
                    </button>
                  )}
                  {selected.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy || dirty}
                      onClick={() => {
                        void confirm({
                          title: 'Archiver ce cours ?',
                          message:
                            'Le cours disparaîtra du catalogue. Vous pourrez le reprendre en brouillon plus tard.',
                          confirmLabel: 'Archiver le cours',
                          danger: true,
                        }).then((accepted) => {
                          if (accepted) {
                            void run(() => teachingService.status(selected, 'ARCHIVED'));
                          }
                        });
                      }}
                    >
                      Archiver
                    </button>
                  )}
                  <Link to={`/cours/${selected.id}`}>Voir la fiche publique</Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        if (
                          !dirty ||
                          (await confirm({
                            title: 'Recharger ce cours ?',
                            message: 'Les changements non enregistrés seront abandonnés.',
                            confirmLabel: 'Recharger le cours',
                          }))
                        ) {
                          await run(() => teachingService.get(selected.id), 'Cours rechargé.');
                        }
                      })();
                    }}
                  >
                    Recharger le cours
                  </button>
                </div>
                {dirty && (
                  <small>Enregistrez vos changements avant de publier ou d’archiver.</small>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
