import 'server-only';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { env } from './env';
import { randomSuffix } from './utils';

// Organisation du stockage (relatif à MEDIA_ROOT) :
//   originals/<mediaId>/<fichier>        fichiers sources (non servis publiquement)
//   hls/<mediaId>/master.m3u8 + v<h>/…   rendus HLS
//   audio/<mediaId>/audio.m4a            audio normalisé
//   waveforms/<mediaId>.json             pics de forme d'onde
//   thumbs/<mediaId>.jpg                 miniatures
//   subtitles/<mediaId>.vtt              sous-titres
//   submissions/<submissionId>/<fichier> pièces jointes des propositions (privées)
//   avatars/<userId>.<ext>
// Cette abstraction (abs/url/save) est le seul point à adapter pour basculer vers MinIO/S3.

export const MEDIA_ROOT = path.resolve(env.mediaRoot);

export function abs(rel: string): string {
  const p = path.resolve(MEDIA_ROOT, rel);
  if (!p.startsWith(MEDIA_ROOT)) throw new Error('Chemin de stockage invalide');
  return p;
}

export async function ensureDir(rel: string) {
  await fsp.mkdir(abs(rel), { recursive: true });
}

// URL publique d'un fichier servi par Nginx (ou par la route /media en dev).
export function publicUrl(rel: string | null | undefined): string | null {
  if (!rel) return null;
  return `${env.mediaPublicBase}/${rel.split(path.sep).join('/')}`;
}

export function safeFileName(name: string): string {
  const base = path.basename(name).normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return base || `fichier_${randomSuffix()}`;
}

// Écrit un fichier reçu en multipart sur disque, en flux (pas de chargement en mémoire).
export async function saveUpload(file: File, relDir: string, fileName?: string): Promise<{ rel: string; size: number; name: string }> {
  await ensureDir(relDir);
  const name = safeFileName(fileName ?? file.name);
  const rel = path.join(relDir, name);
  const nodeStream = Readable.fromWeb(file.stream() as unknown as import('stream/web').ReadableStream);
  await pipeline(nodeStream, fs.createWriteStream(abs(rel)));
  const stat = await fsp.stat(abs(rel));
  return { rel, size: stat.size, name };
}

export async function removeRel(rel?: string | null) {
  if (!rel) return;
  await fsp.rm(abs(rel), { recursive: true, force: true });
}

export async function exists(rel: string): Promise<boolean> {
  try {
    await fsp.access(abs(rel));
    return true;
  } catch {
    return false;
  }
}

export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/x-msvideo', 'video/mpeg'];
export const ALLOWED_AUDIO_MIME = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/webm'];
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export function mimeMatches(mime: string, allowed: string[]): boolean {
  // Certains navigateurs envoient un type vide ou générique : on tolère et on vérifie l'extension côté worker (ffprobe).
  if (!mime || mime === 'application/octet-stream') return true;
  return allowed.includes(mime);
}
