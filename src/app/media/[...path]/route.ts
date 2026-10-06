import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { abs } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Service des fichiers médias publics (HLS, audio, miniatures, formes d'onde, sous-titres).
// En production, Nginx sert directement /media/ depuis le volume (avec cache) et cette route
// n'est jamais atteinte ; elle garantit le fonctionnement en développement et en mode dégradé.
const PUBLIC_DIRS = new Set(['hls', 'audio', 'thumbs', 'waveforms', 'subtitles', 'avatars']);
const MIME: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.vtt': 'text/vtt; charset=utf-8',
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const [root] = resolvedParams.path;
  if (!PUBLIC_DIRS.has(root)) return new NextResponse('Introuvable', { status: 404 });
  let file: string;
  try {
    file = abs(path.join(...resolvedParams.path));
  } catch {
    return new NextResponse('Introuvable', { status: 404 });
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new NextResponse('Introuvable', { status: 404 });
  const stat = fs.statSync(file);
  const ext = path.extname(file).toLowerCase();
  const headers: Record<string, string> = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': ext === '.m3u8' ? 'public, max-age=10' : 'public, max-age=86400, immutable',
  };
  const range = req.headers.get('range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
    headers['content-range'] = `bytes ${start}-${end}/${stat.size}`;
    headers['content-length'] = String(end - start + 1);
    return new NextResponse(Readable.toWeb(fs.createReadStream(file, { start, end })) as unknown as ReadableStream, { status: 206, headers });
  }
  headers['content-length'] = String(stat.size);
  return new NextResponse(Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream, { headers });
}
