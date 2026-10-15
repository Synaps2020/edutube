import type { TeachingEditorProps } from './TeachingField';
import { TextField } from './TeachingField';
import type { TeachingCourse } from '@edutube/contracts/teaching';
export function CoursePresentation({
  selected,
  disabled,
  change,
  subjects,
}: TeachingEditorProps & { subjects: { id: string; name: string }[] }) {
  return (
    <fieldset disabled={disabled}>
      <details open>
        <summary>Présentation du cours</summary>
        <div className="teacher-fields">
          <TextField label="Titre" value={selected.title} onChange={(title) => change({ title })} />
          <TextField
            label="En quelques mots"
            value={selected.shortDescription}
            onChange={(shortDescription) => change({ shortDescription })}
          />
          <TextField
            label="Présentation"
            multiline
            value={selected.description}
            onChange={(description) => change({ description })}
          />
          <div className="teacher-columns">
            <label className="teacher-field">
              Matière
              <select
                value={selected.subjectId}
                onChange={(event) => change({ subjectId: event.target.value })}
              >
                {subjects.map((subject) => (
                  <option value={subject.id} key={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="teacher-field">
              Niveau
              <select
                value={selected.schoolLevel}
                onChange={(event) =>
                  change({
                    schoolLevel: event.target.value as TeachingCourse['schoolLevel'],
                  })
                }
              >
                <option value="PRIMARY">Primaire</option>
                <option value="MIDDLE">Collège</option>
                <option value="SECONDARY">Lycée</option>
              </select>
            </label>
            <label className="teacher-field">
              Langue
              <select
                value={selected.language}
                onChange={(event) =>
                  change({ language: event.target.value as TeachingCourse['language'] })
                }
              >
                <option value="fr">Français</option>
                <option value="wo">Wolof</option>
                <option value="ar">Arabe</option>
                <option value="en">Anglais</option>
              </select>
            </label>
          </div>
          <TextField
            label="Objectifs — un par ligne"
            multiline
            value={selected.outcomes.join('\n')}
            onChange={(value) => change({ outcomes: value.split('\n') })}
          />
          <label className="teacher-field">
            Prérequis — un par ligne
            <textarea
              value={selected.prerequisites.join('\n')}
              onChange={(event) =>
                change({
                  prerequisites: event.target.value ? event.target.value.split('\n') : [],
                })
              }
            />
          </label>
          <div className="teacher-columns">
            <label className="teacher-field">
              Couleur
              <select
                value={selected.palette}
                onChange={(event) =>
                  change({ palette: event.target.value as TeachingCourse['palette'] })
                }
              >
                <option value="blue">Bleu</option>
                <option value="green">Vert</option>
                <option value="orange">Orange</option>
                <option value="purple">Violet</option>
              </select>
            </label>
            <label className="teacher-field">
              Illustration
              <select
                value={selected.illustration}
                onChange={(event) =>
                  change({
                    illustration: event.target.value as TeachingCourse['illustration'],
                  })
                }
              >
                <option value="geometry">Géométrie</option>
                <option value="plant">Sciences</option>
                <option value="writing">Écriture</option>
                <option value="code">Numérique</option>
              </select>
            </label>
          </div>
        </div>
      </details>
    </fieldset>
  );
}
