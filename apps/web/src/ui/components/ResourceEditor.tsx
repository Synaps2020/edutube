import { FilePicker } from './FilePicker';
import { useConfirmation } from '../confirmation-context';
import { useEffect, useRef, useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import type { ResourceDto } from '@edutube/contracts';
import { resourceService } from '../../adapters/http/resources';
import { HttpError } from '../../adapters/http/client';
import { ResourceList } from './ResourceList';
interface ResourceEditorProps {
  courseId: string;
  disabled: boolean;
  lessonId: string;
  revision: number;
  editable: boolean;
  mutate: (action: () => Promise<unknown>) => Promise<boolean>;
}
export function ResourceEditor({
  courseId,
  lessonId,
  revision,
  editable,
  mutate,
  disabled,
}: ResourceEditorProps) {
  const confirm = useConfirmation();
  const [resources, setResources] = useState<ResourceDto[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestKey = useRef(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void resourceService
      .list(courseId, lessonId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setResources(result.resources);
          setSaved(true);
        }
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (failure instanceof HttpError && failure.status === 404) {
          setSaved(false);
          return;
        }
        setError(failure instanceof Error ? failure.message : 'Documents indisponibles.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [courseId, lessonId, revision]);
  const upload = async () => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const succeeded = await mutate(() =>
        resourceService.upload(
          courseId,
          lessonId,
          { title, expectedRevision: revision },
          file,
          requestKey.current,
        ),
      );
      if (succeeded) {
        setFile(null);
        setTitle('');
        requestKey.current = crypto.randomUUID();
        if (fileInput.current) {
          fileInput.current.value = '';
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Ajout impossible.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (resource: ResourceDto) => {
    if (
      !(await confirm({
        title: 'Retirer ce document ?',
        message: `« ${resource.title} » ne sera plus accessible aux élèves. Les notes et la progression seront conservées.`,
        confirmLabel: 'Retirer le document',
        danger: true,
      }))
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await mutate(() => resourceService.remove(courseId, lessonId, resource.id, revision));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Retrait impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="teacher-documents">
      <h4>
        <Paperclip size={18} /> Documents du chapitre
      </h4>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Chargement des documents…</p>
      ) : !saved ? (
        <p>Enregistrez ce chapitre avant d’y joindre un document.</p>
      ) : (
        <>
          <ResourceList resources={resources} />
          {editable &&
            resources.map((resource) => (
              <button
                type="button"
                className="document-remove"
                disabled={busy || disabled}
                key={resource.id}
                onClick={() => void remove(resource)}
              >
                <Trash2 size={15} /> Retirer {resource.title}
              </button>
            ))}
          {!editable ? (
            <p>Enregistrez le brouillon avant de modifier ses documents.</p>
          ) : (
            <fieldset disabled={busy || disabled}>
              <label className="teacher-field">
                Titre du document
                <input
                  maxLength={200}
                  value={title}
                  placeholder="Fiche de révision, exercice, corrigé…"
                  onChange={(event) => {
                    setTitle(event.target.value);
                    requestKey.current = crypto.randomUUID();
                  }}
                />
              </label>
              <FilePicker
                label="Fichier PDF ou TXT · 10 Mo maximum"
                ariaLabel="Choisir un document PDF ou TXT"
                accept=".pdf,.txt"
                fileName={file?.name ?? null}
                inputRef={fileInput}
                onChoose={(selected) => {
                  setFile(selected);
                  requestKey.current = crypto.randomUUID();
                  if (!title && selected) {
                    setTitle(selected.name.replace(/\.[^.]+$/, ''));
                  }
                }}
              />
              <button
                type="button"
                className="button button-secondary"
                disabled={!file || !title.trim()}
                onClick={() => void upload()}
              >
                {busy ? 'Ajout du document…' : 'Joindre le document'}
              </button>
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
