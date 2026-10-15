import { useMemo } from 'react';
import '@videojs/react/video/neutral-skin.css';
import { VideoPlayer, NeutralVideoSkin } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { I18nProvider } from '@videojs/react/i18n';
export default function CourseVideoPlayer({
  source,
  poster,
  title,
  onEnded,
}: {
  source: string;
  poster: string | null;
  title: string;
  onEnded?: () => void;
}) {
  const media = useMemo(
    () => ({
      src: source,
      type: 'application/vnd.apple.mpegurl',
      engine: {
        hlsJs: {
          maxBufferLength: 12,
          maxMaxBufferLength: 18,
          backBufferLength: 12,
          maxBufferSize: 10485760,
        },
      },
    }),
    [source],
  );
  return (
    <div className="course-video-player">
      <I18nProvider locale="fr">
        <VideoPlayer title={title} poster={poster ?? undefined}>
          <NeutralVideoSkin style={{ width: '100%', aspectRatio: '16 / 9' }}>
            <HlsJsVideo source={media} playsInline preload="metadata" onEnded={onEnded} />
          </NeutralVideoSkin>
        </VideoPlayer>
      </I18nProvider>
    </div>
  );
}
