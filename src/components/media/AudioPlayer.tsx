'use client';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { api } from '@/lib/client/api';
import { formatDuration } from '@/lib/utils';

interface Props {
  slug: string;
  audioUrl: string;
  waveformUrl?: string | null;
  startAt?: number;
  durationSec?: number | null;
  canTrack: boolean;
  title: string;
  artist?: string;
  thumbnailUrl?: string | null;
  downloadable?: boolean;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Lecteur audio avec forme d'onde (pics précalculés par le worker → aucun décodage côté client),
// contrôle de vitesse, reprise, et « écoute en arrière-plan » via l'API Media Session
// (contrôles sur l'écran de verrouillage / notifications du téléphone, lecture continue onglet masqué).
export function AudioPlayer({ slug, audioUrl, waveformUrl, startAt = 0, durationSec, canTrack, title, artist, thumbnailUrl, downloadable }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(startAt);
  const [duration, setDuration] = useState(durationSec ?? 0);
  const [speed, setSpeed] = useState(1);
  const [background, setBackground] = useState(true);
  const lastSave = useRef(0);
  const viewSent = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    (async () => {
      let peaks: number[][] | undefined;
      if (waveformUrl) {
        try {
          const r = await fetch(waveformUrl);
          const j = (await r.json()) as { peaks: number[] };
          peaks = [j.peaks];
        } catch { /* on laissera wavesurfer décoder */ }
      }
      if (cancelled || !containerRef.current) return;
      const ws = WaveSurfer.create({
        container: containerRef.current,
        url: audioUrl,
        peaks,
        duration: durationSec ?? undefined,
        waveColor: '#BED1E0',
        progressColor: '#0099CC',
        cursorColor: '#FF9900',
        height: 96,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        backend: 'MediaElement',
      });
      wsRef.current = ws;
      ws.on('ready', (d) => { setReady(true); setDuration(d); if (startAt > 0 && startAt < d) ws.setTime(startAt); });
      ws.on('play', () => setPlaying(true));
      ws.on('pause', () => { setPlaying(false); save(true); });
      ws.on('finish', () => { setPlaying(false); save(true, true); });
      ws.on('timeupdate', (t) => {
        setTime(t);
        if (!viewSent.current && t > 5) { viewSent.current = true; api.post(`/media/${slug}/view`).catch(() => {}); }
        save();
      });
    })();
    const save = (force = false, completed = false) => {
      if (!canTrack || !wsRef.current) return;
      const now = Date.now();
      if (!force && now - lastSave.current < 10000) return;
      lastSave.current = now;
      const pos = Math.floor(wsRef.current.getCurrentTime());
      if (pos > 0 || completed) api.post(`/media/${slug}/progress`, { positionSec: pos, completed: completed || undefined }).catch(() => {});
    };
    return () => { cancelled = true; wsRef.current?.destroy(); wsRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, waveformUrl, slug]);

  useEffect(() => { wsRef.current?.setPlaybackRate(speed, true); }, [speed]);

  // Media Session : métadonnées + actions pour l'écoute en arrière-plan
  useEffect(() => {
    if (!('mediaSession' in navigator) || !background) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: artist ?? 'EduTube', album: 'Ministère de l’Éducation nationale', artwork: thumbnailUrl ? [{ src: thumbnailUrl, sizes: '640x360', type: 'image/png' }] : [] });
    const ws = () => wsRef.current;
    navigator.mediaSession.setActionHandler('play', () => ws()?.play());
    navigator.mediaSession.setActionHandler('pause', () => ws()?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => ws()?.skip(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => ws()?.skip(10));
    return () => { for (const a of ['play', 'pause', 'seekbackward', 'seekforward'] as MediaSessionAction[]) navigator.mediaSession.setActionHandler(a, null); };
  }, [title, artist, thumbnailUrl, background]);

  const toggle = () => wsRef.current?.playPause();
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowLeft' || e.key === 'j') wsRef.current?.skip(-10);
    if (e.key === 'ArrowRight' || e.key === 'l') wsRef.current?.skip(10);
  };

  return (
    <div className="card p-4" onKeyDown={onKey}>
      <div className="flex items-center gap-4">
        {thumbnailUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumbnailUrl} alt="" className="hidden h-24 w-40 rounded object-cover sm:block" />}
        <div className="min-w-0 flex-1">
          <div ref={containerRef} aria-label="Forme d'onde — cliquez pour vous déplacer dans l'enregistrement" role="slider" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)} tabIndex={0} className="cursor-pointer rounded bg-simen-gray-lighter" />
          <div className="mt-1 flex justify-between text-xs text-simen-gray-mid"><span>{formatDuration(time)}</span><span>{formatDuration(duration)}</span></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => wsRef.current?.skip(-10)} className="btn-secondary px-3" aria-label="Reculer de 10 secondes">−10 s</button>
        <button type="button" onClick={toggle} disabled={!ready} className="btn-primary h-12 w-12 rounded-full p-0 text-lg" aria-label={playing ? 'Pause' : 'Lecture'}>{playing ? '❚❚' : '▶'}</button>
        <button type="button" onClick={() => wsRef.current?.skip(10)} className="btn-secondary px-3" aria-label="Avancer de 10 secondes">+10 s</button>
        <label className="flex items-center gap-1 text-sm">Vitesse
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="input w-auto py-1" aria-label="Vitesse de lecture">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} className="h-4 w-4 accent-simen-blue" />
          Écoute en arrière-plan
        </label>
        {downloadable && <a href={`/api/v1/media/${slug}/download`} className="btn-secondary ml-auto" download>Télécharger l’audio</a>}
        {startAt > 10 && <span className="text-xs text-simen-gray-mid">Reprise à {formatDuration(startAt)}</span>}
      </div>
    </div>
  );
}
