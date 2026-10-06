/* eslint-disable no-console */
// Worker de traitement des médias — EduTube
//
// Rôle : consommer la table `Job` (file en base PostgreSQL) et exécuter FFmpeg :
//   - TRANSCODE_VIDEO : sonde (ffprobe), transcodage HLS multi-débit (240p→1080p bornés par
//     la source), master playlist, miniature automatique, puis publication.
//   - PROCESS_AUDIO   : normalisation de sonie (EBU R128, loudnorm deux passes), encodage AAC,
//     extraction de la forme d'onde (pics JSON), miniature générée (forme d'onde), publication.
//
// Pourquoi une file en base plutôt que Redis/BullMQ ? Moins de composants à opérer on-premise ;
// PostgreSQL garantit l'exclusivité via `FOR UPDATE SKIP LOCKED`. Plusieurs workers peuvent
// tourner en parallèle (WORKER_CONCURRENCY et/ou plusieurs réplicas) sans double traitement.
// La migration vers Redis/BullMQ est possible plus tard sans changer le contrat (table Job).

import { PrismaClient, type Job, type Media } from '@prisma/client';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileP = promisify(execFile);
const prisma = new PrismaClient();

const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT ?? './data/media');
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 1);
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';
const X264_PRESET = process.env.FFMPEG_PRESET ?? 'veryfast';
const HLS_SEGMENT_SEC = Number(process.env.HLS_SEGMENT_SEC ?? 6);
const WORKER_ID = `${os.hostname()}-${process.pid}`;

const abs = (rel: string) => path.join(MEDIA_ROOT, rel);

// Échelle de rendus (hauteur, débit vidéo kbps, débit audio kbps)
const LADDER = [
  { height: 240, vb: 400, ab: 64 },
  { height: 480, vb: 1000, ab: 96 },
  { height: 720, vb: 2500, ab: 128 },
  { height: 1080, vb: 4500, ab: 128 },
];

interface ProbeResult {
  duration: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await execFileP(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { maxBuffer: 10 * 1024 * 1024 });
  const info = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type: string; width?: number; height?: number; duration?: string }> };
  const streams = info.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(info.format?.duration ?? v?.duration ?? a?.duration ?? 0);
  return { duration, width: v?.width, height: v?.height, hasAudio: !!a, hasVideo: !!v };
}

// Exécute FFmpeg en rapportant la progression (0-100) via `-progress pipe:1`.
function runFfmpeg(args: string[], durationSec: number, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args, '-progress', 'pipe:1', '-loglevel', 'error']);
    let stderr = '';
    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
      const m = /out_time_ms=(\d+)/g;
      let last: RegExpExecArray | null = null;
      let r: RegExpExecArray | null;
      while ((r = m.exec(stdout)) !== null) last = r;
      if (last && durationSec > 0 && onProgress) {
        onProgress(Math.min(99, Math.round((Number(last[1]) / 1_000_000 / durationSec) * 100)));
      }
      if (stdout.length > 20000) stdout = stdout.slice(-5000);
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
    });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg a échoué (code ${code}) : ${stderr.slice(-2000)}`))));
  });
}

// ---------------------------------------------------------------------------
// Vidéo → HLS
// ---------------------------------------------------------------------------
async function transcodeVideo(media: Media, job: Job) {
  if (!media.originalPath) throw new Error('Fichier source manquant.');
  const src = abs(media.originalPath);
  const info = await probe(src);
  if (!info.hasVideo) throw new Error('Le fichier ne contient pas de piste vidéo.');
  const srcHeight = info.height ?? 720;
  // Rendus ≤ hauteur source ; toujours au moins le plus petit palier.
  let ladder = LADDER.filter((l) => l.height <= srcHeight);
  if (ladder.length === 0) ladder = [LADDER[0]];

  const hlsDir = path.join('hls', media.id);
  await fsp.rm(abs(hlsDir), { recursive: true, force: true });
  await fsp.mkdir(abs(hlsDir), { recursive: true });

  // Une seule passe de décodage, N encodeurs (filtre split) → économie CPU.
  const filter = `[0:v]split=${ladder.length}${ladder.map((_, i) => `[v${i}]`).join('')};` +
    ladder.map((l, i) => `[v${i}]scale=-2:${l.height}:flags=lanczos[o${i}]`).join(';');
  const args: string[] = ['-i', src, '-filter_complex', filter];
  for (let i = 0; i < ladder.length; i++) {
    const l = ladder[i];
    await fsp.mkdir(abs(path.join(hlsDir, `v${l.height}`)), { recursive: true });
    args.push('-map', `[o${i}]`);
    if (info.hasAudio) args.push('-map', '0:a:0');
    args.push(
      `-c:v:${i}`, 'libx264', '-preset', X264_PRESET, '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      `-b:v:${i}`, `${l.vb}k`, `-maxrate:v:${i}`, `${Math.round(l.vb * 1.07)}k`, `-bufsize:v:${i}`, `${l.vb * 2}k`,
      '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    );
    if (info.hasAudio) args.push(`-c:a:${i}`, 'aac', `-b:a:${i}`, `${l.ab}k`, '-ac', '2');
    args.push(
      '-f', 'hls', '-hls_time', String(HLS_SEGMENT_SEC), '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
      '-hls_segment_filename', abs(path.join(hlsDir, `v${l.height}`, 'seg_%04d.ts')),
      abs(path.join(hlsDir, `v${l.height}`, 'index.m3u8')),
    );
  }
  await runFfmpeg(args, info.duration, (pct) => setProgress(job.id, pct));

  // Master playlist
  const master = ['#EXTM3U', '#EXT-X-VERSION:3'];
  const renditions = ladder.map((l) => {
    const bw = (l.vb + (info.hasAudio ? l.ab : 0)) * 1000;
    const w = info.width && info.height ? Math.round((info.width / info.height) * l.height / 2) * 2 : Math.round((16 / 9) * l.height);
    master.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${w}x${l.height},NAME="${l.height}p"`, `v${l.height}/index.m3u8`);
    return { height: l.height, bandwidth: bw, path: `${hlsDir}/v${l.height}/index.m3u8` };
  });
  await fsp.writeFile(abs(path.join(hlsDir, 'master.m3u8')), master.join('\n') + '\n');

  // Miniature automatique (à 10 % de la durée) si aucune miniature fournie par l'administrateur
  let thumbRel = media.thumbnailPath;
  if (!thumbRel) {
    await fsp.mkdir(abs('thumbs'), { recursive: true });
    thumbRel = path.join('thumbs', `${media.id}.jpg`);
    const at = Math.max(0, Math.min(info.duration * 0.1, info.duration - 0.5));
    await runFfmpeg(['-ss', at.toFixed(2), '-i', src, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', abs(thumbRel)], 0);
  }

  return {
    hlsMasterPath: path.join(hlsDir, 'master.m3u8'),
    renditions,
    thumbnailPath: thumbRel,
    durationSec: Math.round(info.duration),
    width: info.width ?? null,
    height: info.height ?? null,
  };
}

// ---------------------------------------------------------------------------
// Audio → AAC normalisé + forme d'onde
// ---------------------------------------------------------------------------
async function processAudio(media: Media, job: Job) {
  if (!media.originalPath) throw new Error('Fichier source manquant.');
  const src = abs(media.originalPath);
  const info = await probe(src);
  if (!info.hasAudio) throw new Error('Le fichier ne contient pas de piste audio.');

  const outDir = path.join('audio', media.id);
  await fsp.mkdir(abs(outDir), { recursive: true });
  const outRel = path.join(outDir, 'audio.m4a');

  // Passe 1 : mesure de la sonie (EBU R128)
  const target = 'I=-16:TP=-1.5:LRA=11';
  let measured: Record<string, string> | null = null;
  try {
    const stderr = await runFfmpeg(['-i', src, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], info.duration, (p) => setProgress(job.id, Math.round(p * 0.4)));
    const jsonStart = stderr.lastIndexOf('{');
    if (jsonStart >= 0) measured = JSON.parse(stderr.slice(jsonStart)) as Record<string, string>;
  } catch (e) {
    console.warn('  loudnorm passe 1 impossible, normalisation en une passe', e);
  }
  // Passe 2 : application linéaire des valeurs mesurées (ou une passe dynamique en repli)
  const ln = measured
    ? `loudnorm=${target}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=summary`
    : `loudnorm=${target}`;
  await runFfmpeg(['-i', src, '-vn', '-af', ln, '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', abs(outRel)], info.duration, (p) => setProgress(job.id, 40 + Math.round(p * 0.5)));

  // Forme d'onde : décodage PCM mono 8 kHz → 1000 pics normalisés
  const peaks = await extractPeaks(abs(outRel), 1000);
  await fsp.mkdir(abs('waveforms'), { recursive: true });
  const waveRel = path.join('waveforms', `${media.id}.json`);
  await fsp.writeFile(abs(waveRel), JSON.stringify({ version: 1, sampleRate: 8000, length: peaks.length, peaks }));

  // Miniature générée à partir de la forme d'onde (charte SIMEN : fond bleu #0099CC, onde orange #FF9900)
  let thumbRel = media.thumbnailPath;
  if (!thumbRel) {
    await fsp.mkdir(abs('thumbs'), { recursive: true });
    thumbRel = path.join('thumbs', `${media.id}.png`);
    await runFfmpeg([
      '-i', abs(outRel), '-f', 'lavfi', '-i', 'color=c=0x0099CC:s=640x360',
      '-filter_complex', '[0:a]showwavespic=s=640x200:colors=0xFF9900|0xFFFFFF:scale=sqrt[w];[1:v][w]overlay=0:80:shortest=1[out]',
      '-map', '[out]', '-frames:v', '1', abs(thumbRel),
    ], 0);
  }

  return { audioPath: outRel, waveformPath: waveRel, thumbnailPath: thumbRel, durationSec: Math.round(info.duration) };
}

function extractPeaks(file: string, buckets: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-']);
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error('Extraction PCM impossible'));
      const buf = Buffer.concat(chunks);
      const samples = buf.length / 2;
      const per = Math.max(1, Math.floor(samples / buckets));
      const peaks: number[] = [];
      for (let b = 0; b < buckets; b++) {
        let max = 0;
        const start = b * per;
        if (start >= samples) break;
        for (let i = start; i < Math.min(samples, start + per); i++) {
          const v = Math.abs(buf.readInt16LE(i * 2));
          if (v > max) max = v;
        }
        peaks.push(Number((max / 32768).toFixed(3)));
      }
      resolve(peaks);
    });
  });
}

// ---------------------------------------------------------------------------
// Boucle principale
// ---------------------------------------------------------------------------
async function setProgress(jobId: string, progress: number) {
  try {
    await prisma.job.update({ where: { id: jobId }, data: { progress } });
  } catch { /* ignore */ }
}

async function claimJob(): Promise<Job | null> {
  // Verrouillage atomique : un seul worker obtient le job.
  const rows = await prisma.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedBy" = ${WORKER_ID}, "lockedAt" = NOW(), "startedAt" = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job" WHERE status = 'QUEUED' ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

async function processJob(job: Job) {
  const media = await prisma.media.findUnique({ where: { id: job.mediaId } });
  if (!media) throw new Error('Média introuvable.');
  console.log(`▶ job ${job.id} (${job.type}) — média "${media.title}"`);
  const payload = (job.payload ?? {}) as { publishWhenDone?: boolean };

  const result = job.type === 'TRANSCODE_VIDEO' ? await transcodeVideo(media, job) : await processAudio(media, job);

  const publish = payload.publishWhenDone !== false;
  const updated = await prisma.media.update({
    where: { id: media.id },
    data: {
      ...result,
      processingError: null,
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? media.publishedAt ?? new Date() : media.publishedAt,
    },
  });
  await prisma.job.update({ where: { id: job.id }, data: { status: 'DONE', progress: 100, finishedAt: new Date(), error: null } });

  // Notifications : téléverseur, contributeur, abonnés de la chaîne
  const link = `/media/${updated.slug}`;
  await prisma.notification.create({ data: { userId: media.uploaderId, type: 'SYSTEM', title: `Traitement terminé : « ${media.title} »`, body: publish ? 'Le contenu est maintenant publié.' : 'Le contenu est prêt ; vous pouvez le publier depuis l’administration.', link: publish ? link : `/admin/contenus/${media.id}` } });
  if (publish) {
    if (media.contributorId && media.contributorId !== media.uploaderId) {
      await prisma.notification.create({ data: { userId: media.contributorId, type: 'MEDIA_PUBLISHED', title: `Votre contenu « ${media.title} » est publié`, link } });
    }
    const subs = await prisma.subscription.findMany({ where: { channelId: media.channelId }, select: { userId: true } });
    if (subs.length) {
      await prisma.notification.createMany({ data: subs.map((s) => ({ userId: s.userId, type: 'MEDIA_PUBLISHED' as const, title: `Nouveau contenu : « ${media.title} »`, link })) });
    }
  }
  console.log(`✔ job ${job.id} terminé (${publish ? 'publié' : 'brouillon'})`);
}

async function failJob(job: Job, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✖ job ${job.id} : ${message}`);
  const exhausted = job.attempts >= job.maxAttempts;
  await prisma.job.update({ where: { id: job.id }, data: { status: exhausted ? 'FAILED' : 'QUEUED', error: message.slice(0, 4000), lockedBy: null, lockedAt: null, finishedAt: exhausted ? new Date() : null } });
  if (exhausted) {
    const media = await prisma.media.update({ where: { id: job.mediaId }, data: { status: 'FAILED', processingError: message.slice(0, 2000) } });
    await prisma.notification.create({ data: { userId: media.uploaderId, type: 'SYSTEM', title: `Échec du traitement : « ${media.title} »`, body: message.slice(0, 300), link: `/admin/contenus/${media.id}` } });
  }
}

async function recoverStaleJobs() {
  // Jobs verrouillés depuis plus de 3 h (worker tué en plein traitement) → remis en file.
  const r = await prisma.job.updateMany({ where: { status: 'RUNNING', lockedAt: { lt: new Date(Date.now() - 3 * 3600 * 1000) } }, data: { status: 'QUEUED', lockedBy: null, lockedAt: null } });
  if (r.count) console.log(`↺ ${r.count} job(s) orphelin(s) remis en file`);
}

let running = 0;
let stopping = false;

async function tick() {
  if (stopping) return;
  while (running < CONCURRENCY) {
    const job = await claimJob();
    if (!job) break;
    running += 1;
    processJob(job)
      .catch((e) => failJob(job, e))
      .finally(() => { running -= 1; });
  }
}

async function main() {
  fs.mkdirSync(MEDIA_ROOT, { recursive: true });
  try {
    await execFileP(FFMPEG, ['-version']);
  } catch {
    console.error('FFmpeg introuvable. Installez ffmpeg ou définissez FFMPEG_PATH.');
    process.exit(1);
  }
  console.log(`Worker ${WORKER_ID} démarré — MEDIA_ROOT=${MEDIA_ROOT}, concurrence=${CONCURRENCY}, intervalle=${POLL_MS}ms`);
  await recoverStaleJobs();
  setInterval(() => { recoverStaleJobs().catch(() => {}); }, 15 * 60 * 1000);
  const loop = async () => {
    try { await tick(); } catch (e) { console.error('Erreur de boucle', e); }
    if (!stopping) setTimeout(loop, POLL_MS);
  };
  loop();
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    console.log(`Arrêt demandé (${sig}), fin des traitements en cours…`);
    stopping = true;
    const wait = () => { if (running === 0) { prisma.$disconnect().finally(() => process.exit(0)); } else setTimeout(wait, 500); };
    wait();
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
