import { lazy, Suspense, useEffect, useState } from 'react';
import type { VideoView } from '@edutube/contracts/videos';
import { videoService } from '../../adapters/http/videos';
const Player = lazy(() => import('./VideoPlayer'));
export function LessonVideo({
  courseId,
  lessonId,
  title,
  onEnded,
}: {
  courseId: string;
  lessonId: string;
  title: string;
  onEnded?: () => void;
}) {
  const [video, setVideo] = useState<VideoView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setVideo(null);
    videoService
      .playback(courseId, lessonId, controller.signal)
      .then(setVideo)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Vidéo indisponible.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [courseId, lessonId]);
  if (error) {
    return (
      <div className="video-message" role="alert">
        {error}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="video-message" role="status">
        Chargement de la vidéo…
      </div>
    );
  }
  if (!video) {
    return (
      <div className="video-message">
        Ce chapitre se travaille avec la fiche et les ressources ci-dessous.
      </div>
    );
  }
  if (!video.playbackUrl) {
    return (
      <div className="video-message" role="status">
        {video.status === 'FAILED'
          ? video.errorMessage
          : 'Votre enseignant prépare cette vidéo. Revenez dans un instant.'}
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="video-message">Préparation du lecteur…</div>}>
      <Player source={video.playbackUrl} poster={video.posterUrl} title={title} onEnded={onEnded} />
    </Suspense>
  );
}
