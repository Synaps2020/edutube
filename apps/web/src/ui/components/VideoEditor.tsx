import { FilePicker } from './FilePicker';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { VideoView } from '@edutube/contracts/videos';
import { videoLimit } from '@edutube/contracts/videos';
import { videoService } from '../../adapters/http/videos';
import { useConfirmation } from '../confirmation-context';
const Player = lazy(() => import('./VideoPlayer'));
export function VideoEditor({
  courseId,
  lessonId,
  revision,
  editable,
  mutate,
}: {
  courseId: string;
  lessonId: string;
  revision: number;
  editable: boolean;
  mutate: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [video, setVideo] = useState<VideoView | null>(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const key = useRef(crypto.randomUUID());
  const upload = useRef<AbortController | null>(null);
  const confirm = useConfirmation();
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const result = await videoService.teacher(courseId, lessonId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setVideo(result.video);
        setError('');
        if (result.video && ['QUEUED', 'PROCESSING'].includes(result.video.status)) {
          timer = setTimeout(() => {
            void load();
          }, 2500);
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Vidéo indisponible.');
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [courseId, lessonId, revision]);
  useEffect(() => () => upload.current?.abort(), []);
  const send = async () => {
    if (!file || busy) {
      return;
    }
    if (file.size > videoLimit) {
      setError('Choisissez une vidéo de moins de 1 Go.');
      return;
    }
    setBusy(true);
    setError('');
    const controller = new AbortController();
    upload.current = controller;
    try {
      const succeeded = await mutate(async () => {
        const result = await videoService.upload(
          courseId,
          lessonId,
          revision,
          file,
          key.current,
          controller.signal,
        );
        setVideo(result.video);
        return result;
      });
      if (succeeded) {
        setFile(null);
        key.current = crypto.randomUUID();
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Envoi impossible.');
      }
    } finally {
      setBusy(false);
      upload.current = null;
    }
  };
  const remove = async () => {
    if (
      !(await confirm({
        title: 'Retirer cette vidéo ?',
        message:
          'Elle ne sera plus accessible aux élèves. Vous pourrez ensuite joindre une autre vidéo.',
        confirmLabel: 'Retirer la vidéo',
        danger: true,
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await mutate(async () => {
        const result = await videoService.remove(courseId, lessonId, revision);
        setVideo(result.video);
        return result;
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="teacher-video">
      <h4>Vidéo du chapitre</h4>
      {error && <p role="alert">{error}</p>}
      {video ? (
        <>
          <p>
            <strong>{video.fileName}</strong> · {(video.sizeBytes / 1048576).toFixed(1)} Mo
          </p>
          <p className="video-status" role="status">
            {video.status === 'READY'
              ? '✓ Prête à regarder'
              : video.status === 'QUEUED'
                ? 'En attente de préparation…'
                : video.status === 'PROCESSING'
                  ? 'Préparation des qualités vidéo…'
                  : video.errorMessage}
          </p>
          {video.playbackUrl && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPreview(!preview)}
            >
              {preview ? 'Fermer l’aperçu' : 'Regarder l’aperçu'}
            </button>
          )}
          {preview && video.playbackUrl && (
            <Suspense fallback={<p>Chargement du lecteur…</p>}>
              <Player source={video.playbackUrl} poster={video.posterUrl} title={video.fileName} />
            </Suspense>
          )}
          {editable && (
            <button
              type="button"
              disabled={busy}
              className="text-link"
              onClick={() => void remove()}
            >
              Retirer la vidéo
            </button>
          )}
        </>
      ) : editable || busy ? (
        <>
          <FilePicker
            label="Vidéo MP4 · 1 Go maximum"
            ariaLabel="Choisir une vidéo MP4"
            accept="video/mp4,.mp4"
            fileName={file?.name ?? null}
            disabled={busy}
            onChoose={(selected) => {
              setFile(selected);
              key.current = crypto.randomUUID();
            }}
          />
          <p>Le cours pourra être publié quand la préparation sera terminée.</p>
          <button
            type="button"
            className="button"
            disabled={!file || busy}
            onClick={() => void send()}
          >
            {busy ? 'Envoi en cours…' : 'Joindre la vidéo'}
          </button>
          {busy && <progress aria-label="Envoi de la vidéo" />}
        </>
      ) : (
        <p>Enregistrez le brouillon avant de joindre une vidéo.</p>
      )}
    </div>
  );
}
