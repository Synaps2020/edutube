import fs from 'fs';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { handler, notFound, forbidden } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { findMediaByKey } from '@/lib/media';
import { abs } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/v1/media/:slug/download — téléchargement (si autorisé par l'administrateur) du fichier
// Vidéo : rendu le plus élevé n'étant pas disponible en fichier unique, on sert l'original ;
// Audio : fichier normalisé. Les administrateurs peuvent toujours télécharger.
export const GET = handler(async (_req, { params }) => {
  const user = await requireUser();
  const media = await findMediaByKey(params.slug);
  if (!media) throw notFound();
  if (user.role !== 'ADMIN' && (media.status !== 'PUBLISHED' || !media.downloadable)) throw forbidden('Le téléchargement de ce contenu n’est pas autorisé.');
  const rel = media.type === 'AUDIO' ? media.audioPath ?? media.originalPath : media.originalPath;
  if (!rel || !fs.existsSync(abs(rel))) throw notFound('Fichier indisponible.');
  const stat = fs.statSync(abs(rel));
  const ext = rel.split('.').pop();
  const fileName = `${media.slug}.${ext}`;
  await audit({ actorId: user.id, action: 'MEDIA_DOWNLOAD', entity: 'Media', entityId: media.id });
  const stream = Readable.toWeb(fs.createReadStream(abs(rel))) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'content-type': media.type === 'AUDIO' ? 'audio/mp4' : 'application/octet-stream',
      'content-length': String(stat.size),
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'private, no-store',
    },
  });
}, { csrf: false });
