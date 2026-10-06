'use client';
import { useEffect, useRef, useState } from 'react';
import Hls, { type Level } from 'hls.js';
import { api } from '@/lib/client/api';
import { formatDuration } from '@/lib/utils';

interface Props {
  slug: string;
  hlsUrl: string;
  poster?: string | null;
  subtitlesUrl?: string | null;
  startAt?: number;
  durationSec?: number | null;
  canTrack: boolean; // utilisateur authentifié → sauvegarde de la progression
  title: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Lecteur vidéo HLS à débit adaptatif (hls.js ; lecture native sur Safari/iOS).
// - reprise de lecture (startAt), sauvegarde périodique de la progression
// - sélection de qualité (auto / 240p … 1080p), vitesse, sous-titres WebVTT, plein écran (contrôles natifs)
// - mode connectivité limitée : démarre au niveau le plus bas puis monte (startLevel=0, ABR), préchargement adaptatif
export function VideoPlayer({ slug, hlsUrl, poster, subtitlesUrl, startAt = 0, durationSec, canTrack, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [resumed, setResumed] = useState(startAt > 10);
  const [error, setError] = useState<string | null>(null);
  const [saveData, setSaveData] = useState(false);
  const lastSave = useRef(0);
  const viewSent = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Détection "économie de données" / connexion lente (Network Information API si disponible)
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const lowBw = !!conn && (conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType ?? ''));
    setSaveData(lowBw);

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: 0,                 // démarre bas, monte selon la bande passante mesurée
        capLevelToPlayerSize: true,    // n'excède pas la taille d'affichage
        maxBufferLength: lowBw ? 15 : 30,
        maxMaxBufferLength: lowBw ? 60 : 120,
        abrEwmaDefaultEstimate: lowBw ? 300000 : 1000000,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => { setLevels(data.levels); if (startAt > 0) video.currentTime = startAt; });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setActiveLevel(data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { setError('Connexion instable : nouvelle tentative…'); setTimeout(() => hls.startLoad(), 2000); }
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else setError('Lecture impossible. Réessayez plus tard.');
        }
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => { if (startAt > 0) video.currentTime = startAt; }, { once: true });
    } else {
      setError('Votre navigateur ne prend pas en charge la lecture HLS.');
    }
  }, [hlsUrl, startAt]);

  // Progression / vue
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const save = (force = false) => {
      if (!canTrack) return;
      const now = Date.now();
      if (!force && now - lastSave.current < 10000) return;
      lastSave.current = now;
      const pos = Math.floor(video.currentTime);
      if (pos > 0) api.post(`/media/${slug}/progress`, { positionSec: pos, completed: video.ended || (durationSec ? pos >= durationSec * 0.9 : false) }).catch(() => {});
    };
    const onTime = () => {
      if (!viewSent.current && video.currentTime > 5) { viewSent.current = true; api.post(`/media/${slug}/view`).catch(() => {}); }
      save();
    };
    const onPause = () => save(true);
    const onEnded = () => save(true);
    const onUnload = () => save(true);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    window.addEventListener('beforeunload', onUnload);
    return () => { save(true); video.removeEventListener('timeupdate', onTime); video.removeEventListener('pause', onPause); video.removeEventListener('ended', onEnded); window.removeEventListener('beforeunload', onUnload); };
  }, [slug, canTrack, durationSec]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed]);

  const changeLevel = (l: number) => { setCurrentLevel(l); if (hlsRef.current) hlsRef.current.currentLevel = l; };

  // Raccourcis clavier supplémentaires (J/K/L, flèches) sur le conteneur
  const onKey = (e: React.KeyboardEvent) => {
    const v = videoRef.current; if (!v) return;
    if (e.key === 'k' || e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
    else if (e.key === 'j' || e.key === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - 10); }
    else if (e.key === 'l' || e.key === 'ArrowRight') { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); }
    else if (e.key === 'f') { v.requestFullscreen?.(); }
    else if (e.key === 'm') { v.muted = !v.muted; }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-black" onKeyDown={onKey}>
      <video ref={videoRef} controls playsInline preload="metadata" poster={poster ?? undefined} crossOrigin="anonymous" className="aspect-video w-full bg-black" aria-label={`Lecteur vidéo : ${title}`} controlsList="nodownload">
        {subtitlesUrl && <track kind="subtitles" srcLang="fr" label="Sous-titres (français)" src={subtitlesUrl} default />}
        Votre navigateur ne prend pas en charge la lecture vidéo.
      </video>
      <div className="flex flex-wrap items-center gap-3 bg-simen-gray-dark px-3 py-2 text-xs text-white">
        {resumed && (
          <span className="flex items-center gap-2 rounded bg-simen-orange/90 px-2 py-1 font-semibold text-white">
            Reprise à {formatDuration(startAt)}
            <button type="button" className="underline" onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; setResumed(false); }}>Recommencer</button>
            <button type="button" aria-label="Fermer" onClick={() => setResumed(false)}>✕</button>
          </span>
        )}
        <label className="flex items-center gap-1">Vitesse
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded bg-white/10 px-1 py-0.5 text-white" aria-label="Vitesse de lecture">
            {SPEEDS.map((s) => <option key={s} value={s} className="text-black">{s}×</option>)}
          </select>
        </label>
        {levels.length > 0 && (
          <label className="flex items-center gap-1">Qualité
            <select value={currentLevel} onChange={(e) => changeLevel(Number(e.target.value))} className="rounded bg-white/10 px-1 py-0.5 text-white" aria-label="Qualité vidéo">
              <option value={-1} className="text-black">Auto{activeLevel != null && levels[activeLevel] ? ` (${levels[activeLevel].height}p)` : ''}</option>
              {levels.map((l, i) => <option key={i} value={i} className="text-black">{l.height}p</option>)}
            </select>
          </label>
        )}
        {saveData && <span className="rounded bg-white/10 px-2 py-0.5" title="Connexion limitée détectée : qualité réduite et préchargement allégé">Mode connexion limitée</span>}
        <span className="ml-auto text-simen-gray-light">Raccourcis : espace/K lecture, J/L ±10 s, F plein écran, M muet</span>
        {error && <span role="alert" className="w-full text-simen-orange">{error}</span>}
      </div>
    </div>
  );
}
