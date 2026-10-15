import { newTeachingQuestion } from '../../application/teaching';
import type { TeachingEditorProps } from './TeachingField';
import { TextField } from './TeachingField';
export function QuizEditor({ selected, change, disabled }: TeachingEditorProps) {
  const quiz = selected.quiz;
  return (
    <fieldset disabled={disabled}>
      <details>
        <summary>Quiz et corrections</summary>
        <div className="teacher-fields">
          <p>Les réponses correctes et les explications restent réservées à votre espace.</p>
          {!quiz ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                change({
                  quiz: {
                    passingScore: 70,
                    title: 'Vérifiez vos acquis',
                    questions: [newTeachingQuestion()],
                  },
                })
              }
            >
              Préparer un quiz
            </button>
          ) : (
            <>
              <TextField
                label="Titre du quiz"
                value={quiz.title}
                onChange={(title) => change({ quiz: { ...quiz, title } })}
              />
              <label className="teacher-field">
                Score nécessaire pour débloquer les chapitres (%)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quiz.passingScore}
                  onChange={(event) =>
                    change({ quiz: { ...quiz, passingScore: Number(event.target.value) } })
                  }
                />
              </label>
              {quiz.questions.map((question, index) => {
                const editQuestion = (patch: Partial<typeof question>) =>
                  change({
                    quiz: {
                      ...quiz,
                      questions: quiz.questions.map((item) =>
                        item.id === question.id ? { ...item, ...patch } : item,
                      ),
                    },
                  });
                return (
                  <article className="teacher-chapter" key={question.id}>
                    <strong>Question {index + 1}</strong>
                    <TextField
                      label="Énoncé"
                      value={question.prompt}
                      onChange={(prompt) => editQuestion({ prompt })}
                    />
                    {question.options.map((option) => (
                      <div className="teacher-answer" key={option.id}>
                        <input
                          type="radio"
                          aria-label={`Réponse correcte : ${option.text}`}
                          name={question.id}
                          checked={question.correctOptionId === option.id}
                          onChange={() => editQuestion({ correctOptionId: option.id })}
                        />
                        <TextField
                          label="Choix"
                          value={option.text}
                          onChange={(text) =>
                            editQuestion({
                              options: question.options.map((item) =>
                                item.id === option.id ? { ...item, text } : item,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    <TextField
                      label="Explication après correction"
                      multiline
                      value={question.explanation}
                      onChange={(explanation) => editQuestion({ explanation })}
                    />
                    <button
                      type="button"
                      disabled={quiz.questions.length === 1}
                      onClick={() =>
                        change({
                          quiz: {
                            ...quiz,
                            questions: quiz.questions.filter((item) => item.id !== question.id),
                          },
                        })
                      }
                    >
                      Retirer cette question
                    </button>
                  </article>
                );
              })}
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  change({
                    quiz: { ...quiz, questions: [...quiz.questions, newTeachingQuestion()] },
                  });
                }}
              >
                Ajouter une question
              </button>
            </>
          )}
        </div>
      </details>
    </fieldset>
  );
}
