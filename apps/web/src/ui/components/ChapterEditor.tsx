import { VideoEditor } from './VideoEditor';
import { ResourceEditor } from './ResourceEditor';
import { newTeachingLesson } from '../../application/teaching';
import type { TeachingEditorProps } from './TeachingField';
import { TextField } from './TeachingField';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
export function ChapterEditor({
  selected,
  change,
  disabled,
  documentsEnabled,
  mutateDocuments,
}: TeachingEditorProps & {
  documentsEnabled: boolean;
  mutateDocuments: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  return (
    <details open>
      <summary>Chapitres · {selected.lessons.length}</summary>
      <div className="teacher-fields">
        <p>
          L’ordre ci-dessous sera celui de vos élèves. Les chapitres enregistrés sont conservés pour
          préserver leur progression.
        </p>
        {selected.lessons.map((lesson, index) => {
          const editLesson = (patch: Partial<typeof lesson>) =>
            change({
              lessons: selected.lessons.map((item) =>
                item.id === lesson.id ? { ...item, ...patch } : item,
              ),
            });
          const move = (offset: number) => {
            const lessons = [...selected.lessons];
            [lessons[index], lessons[index + offset]] = [lessons[index + offset], lessons[index]];
            change({ lessons });
          };
          return (
            <article className="teacher-chapter" key={lesson.id}>
              <fieldset disabled={disabled}>
                <header>
                  <strong>Chapitre {index + 1}</strong>
                  <div>
                    <button
                      type="button"
                      aria-label="Monter le chapitre"
                      disabled={index === 0}
                      onClick={() => move(-1)}
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Descendre le chapitre"
                      disabled={index === selected.lessons.length - 1}
                      onClick={() => move(1)}
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                </header>
                <TextField
                  label="Titre du chapitre"
                  value={lesson.title}
                  onChange={(title) => editLesson({ title })}
                />
                <div className="teacher-columns">
                  <label className="teacher-field">
                    Format
                    <select
                      value={lesson.kind}
                      onChange={(event) =>
                        editLesson({ kind: event.target.value as typeof lesson.kind })
                      }
                    >
                      <option value="VIDEO">Vidéo</option>
                      <option value="READING">Lecture</option>
                      <option value="PRACTICE">Activité</option>
                    </select>
                  </label>
                  <label className="teacher-field">
                    Durée en minutes
                    <input
                      required
                      type="number"
                      min="1"
                      max="600"
                      value={lesson.estimatedMinutes}
                      onChange={(event) =>
                        editLesson({ estimatedMinutes: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={lesson.previewAllowed}
                    onChange={(event) => editLesson({ previewAllowed: event.target.checked })}
                  />{' '}
                  Autoriser un aperçu public
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={lesson.requiresQuiz}
                    disabled={disabled || !selected.quiz}
                    onChange={(event) =>
                      editLesson({
                        requiresQuiz: event.target.checked,
                        ...(event.target.checked ? { previewAllowed: false } : {}),
                      })
                    }
                  />{' '}
                  Réussir l’examen du cours avant ce chapitre et les suivants
                </label>
                {lesson.requiresQuiz && (
                  <p>
                    Ce chapitre reste bloqué jusqu’à la réussite du quiz avec au moins{' '}
                    {selected.quiz?.passingScore ?? 70}%.
                  </p>
                )}
                {lesson.blocks.map((block, position) => (
                  <div key={position}>
                    {block.type === 'EXAMPLE' && (
                      <TextField
                        label="Titre de l’exemple"
                        value={block.title}
                        onChange={(title) =>
                          editLesson({
                            blocks: lesson.blocks.map((item, rank) =>
                              rank === position ? { ...block, title } : item,
                            ),
                          })
                        }
                      />
                    )}
                    <TextField
                      label={block.type === 'EXAMPLE' ? 'Exemple' : 'Texte de la leçon'}
                      multiline
                      value={block.text}
                      onChange={(text) =>
                        editLesson({
                          blocks: lesson.blocks.map((item, rank) =>
                            rank === position ? { ...block, text } : item,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    editLesson({
                      blocks: [
                        ...lesson.blocks,
                        { type: 'PARAGRAPH', text: 'Poursuivez votre explication.' },
                      ],
                    })
                  }
                >
                  Ajouter un paragraphe
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editLesson({
                      blocks: [
                        ...lesson.blocks,
                        {
                          type: 'EXAMPLE',
                          title: 'À vous de jouer',
                          text: 'Ajoutez un exemple concret.',
                        },
                      ],
                    })
                  }
                >
                  Ajouter un exemple
                </button>
              </fieldset>
              <VideoEditor
                courseId={selected.id}
                lessonId={lesson.id}
                revision={selected.revision}
                editable={documentsEnabled}
                mutate={mutateDocuments}
              />
              <ResourceEditor
                disabled={disabled}
                courseId={selected.id}
                lessonId={lesson.id}
                revision={selected.revision}
                editable={documentsEnabled}
                mutate={mutateDocuments}
              />
            </article>
          );
        })}
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled}
          onClick={() =>
            change({
              lessons: [...selected.lessons, newTeachingLesson()],
            })
          }
        >
          <Plus size={16} /> Ajouter un chapitre
        </button>
      </div>
    </details>
  );
}
