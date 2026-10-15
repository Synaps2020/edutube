import { useEffect, useState } from 'react';
import { ResourceList } from './ResourceList';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { Course } from '../../domain/course';
import { api } from '../../adapters/http/runtime';
import type { QuizDto, QuizAttemptDto, ResourceDto } from '@edutube/contracts';
import { useStudy } from '../study-context';
export function StudyTools({
  course,
  lessonId,
  resources,
  onAttempt,
  examScore,
}: {
  course: Course;
  lessonId: string;
  resources: ResourceDto[];
  onAttempt?: () => void;
  examScore?: number;
}) {
  const [tab, setTab] = useState('resume');
  const { state, note, score, noteReady, noteStatus, loading, loadNote, flushNote, resolveNote } =
    useStudy();
  const [noteError, setNoteError] = useState('');
  useEffect(() => {
    if (!loading) {
      void loadNote(lessonId).catch((failure: unknown) =>
        setNoteError(failure instanceof Error ? failure.message : 'Note indisponible.'),
      );
    }
    return () => {
      void flushNote(lessonId).catch(() => undefined);
    };
  }, [lessonId, loading, loadNote, flushNote]);
  const status = noteStatus[lessonId];
  const resolve = async (choice: 'retry' | 'reload' | 'keep') => {
    setNoteError('');
    try {
      await resolveNote(lessonId, choice);
    } catch (failure) {
      setNoteError(failure instanceof Error ? failure.message : 'Enregistrement impossible.');
    }
  };
  return (
    <div className="study-tools">
      <div className="study-tabs" aria-label="Outils du chapitre">
        {[
          { id: 'resume', label: 'À retenir' },
          { id: 'notes', label: 'Mes notes' },
          { id: 'ressources', label: 'Ressources' },
          { id: 'quiz', label: examScore ? 'Passer l’examen' : 'M’entraîner' },
        ].map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="study-content">
        {tab === 'resume' && (
          <>
            <span className="eyebrow">FICHE DU CHAPITRE</span>
            <h2>L’essentiel du cours</h2>
            <p>{course.material.summary}</p>
            {course.material.example && (
              <div className="worked-example">
                <h3>Un exemple pour comprendre</h3>
                <p>{course.material.example}</p>
              </div>
            )}
            <p className="demo-note">
              Relisez cette leçon, puis utilisez vos notes et les documents joints pour vous
              entraîner.
            </p>
          </>
        )}
        {tab === 'notes' && (
          <>
            <h2>Gardez une trace de votre déclic.</h2>
            <p>
              Une idée, une question, une méthode à retenir. Ces notes sont liées à ce chapitre.
            </p>
            <label className="note-label" htmlFor="lesson-note">
              Mes notes personnelles
            </label>
            <textarea
              id="lesson-note"
              rows={8}
              maxLength={20000}
              disabled={!noteReady[lessonId] || loading}
              placeholder="Ce que j’ai compris, ce que je veux revoir…"
              value={state.notes[lessonId] ?? ''}
              onChange={(event) => note(course, lessonId, event.target.value)}
            />
            <p className="note-status" role="status">
              {!noteReady[lessonId]
                ? 'Chargement de la note…'
                : status?.status === 'pending'
                  ? 'Modifications en attente…'
                  : status?.status === 'saving'
                    ? 'Enregistrement…'
                    : status?.status === 'error' || status?.status === 'conflict'
                      ? 'Votre texte est conservé ici, mais n’est pas encore enregistré.'
                      : status?.status === 'saved'
                        ? 'Enregistré dans votre compte'
                        : 'Enregistrement automatique dans votre compte'}
            </p>
            {(noteError || status?.message) && <p role="alert">{noteError || status?.message}</p>}
            {status?.status === 'error' && (
              <button className="button button-secondary" onClick={() => void resolve('retry')}>
                Réessayer l’enregistrement
              </button>
            )}
            {status?.status === 'conflict' && (
              <div className="lesson-actions">
                <button className="button button-secondary" onClick={() => void resolve('reload')}>
                  Charger la version enregistrée
                </button>
                <button className="button" onClick={() => void resolve('keep')}>
                  Garder mon texte
                </button>
              </div>
            )}
          </>
        )}
        {tab === 'ressources' && (
          <>
            <h2>À garder sous la main</h2>
            <p>Les documents de votre enseignant, à télécharger pour travailler hors ligne.</p>
            <ResourceList resources={resources} />
          </>
        )}
        {tab === 'quiz' && (
          <CourseQuiz
            key={course.id}
            course={course}
            onAttempt={onAttempt}
            passingScore={examScore}
            onScore={(percent) => score(course.id, percent)}
          />
        )}
      </div>
    </div>
  );
}
export function CourseQuiz({
  course,
  onScore,
  onAttempt,
  passingScore,
}: {
  course: Course;
  onScore?: (percent: number) => void;
  onAttempt?: () => void;
  passingScore?: number;
}) {
  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const controller = new AbortController();
    api.quizzes
      .get(course.id, { signal: controller.signal })
      .then(setQuiz)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Exercice indisponible.');
        }
      });
    return () => controller.abort();
  }, [course.id]);
  const submit = async () => {
    if (!quiz || busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const attempt = await api.quizzes.submit(
        quiz.id,
        {
          quizRevision: quiz.revision,
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            optionId: answers[question.id],
          })),
        },
        { idempotencyKey: requestKey },
      );
      setResult(attempt);
      onScore?.(attempt.summary.scorePercent);
      onAttempt?.();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Réponses non enregistrées. Réessayez.',
      );
    } finally {
      setBusy(false);
    }
  };
  if (!quiz) {
    return <p role={error ? 'alert' : 'status'}>{error || 'Chargement des questions…'}</p>;
  }
  return (
    <div className="quiz">
      <span className="eyebrow">
        {passingScore ? 'EXAMEN · POUR POURSUIVRE' : 'AUTO-ÉVALUATION · SANS PRESSION'}
      </span>
      <h2>{passingScore ? 'Une étape avant la suite.' : 'Voyons ce qui reste.'}</h2>
      <p>
        {quiz.questions.length} questions pour faire le point. Vos réponses sont corrigées et
        enregistrées dans votre compte.
      </p>
      {passingScore && <p>Obtenez au moins {passingScore}% pour débloquer la suite du cours.</p>}
      <details className="quiz-example">
        <summary>Revoir l’exemple avant de répondre</summary>
        <p>{course.material.example}</p>
      </details>
      {quiz.questions.map((question, index) => {
        const correction = result?.corrections.find((item) => item.questionId === question.id);
        return (
          <fieldset key={question.id} disabled={!!result || busy}>
            <legend>
              {index + 1}. {question.prompt}
            </legend>
            {question.options.map((option) => (
              <label
                key={option.id}
                className={
                  correction
                    ? option.id === correction.correctOptionId
                      ? 'answer-correct'
                      : answers[question.id] === option.id
                        ? 'answer-wrong'
                        : ''
                    : ''
                }
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id] === option.id}
                  onChange={() => {
                    setAnswers((previous) => ({ ...previous, [question.id]: option.id }));
                    setRequestKey(crypto.randomUUID());
                  }}
                />
                {option.text}
              </label>
            ))}
            {correction && <p className="answer-explanation">{correction.explanation}</p>}
          </fieldset>
        );
      })}
      {error && <p role="alert">{error}</p>}
      {result ? (
        <>
          <div className="quiz-result" role="status">
            <CheckCircle2 size={25} />
            <div>
              <strong>
                {result.summary.correctCount} / {result.summary.questionCount} réponses correctes ·{' '}
                {result.summary.scorePercent}%
              </strong>
              <p>
                {result.summary.scorePercent === 100
                  ? 'Bien joué. Vous pouvez poursuivre.'
                  : 'Relisez les explications et essayez à nouveau.'}
              </p>
            </div>
          </div>
          <button
            className="button button-secondary"
            onClick={() => {
              setAnswers({});
              setResult(null);
              setRequestKey(crypto.randomUUID());
            }}
          >
            <RotateCcw size={16} />
            Réessayer
          </button>
        </>
      ) : (
        <button
          className="button"
          disabled={busy || !quiz.questions.every((question) => answers[question.id])}
          onClick={() => void submit()}
        >
          {busy ? 'Correction en cours…' : 'Vérifier mes réponses'}
        </button>
      )}
    </div>
  );
}
