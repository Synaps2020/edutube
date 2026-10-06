import { prisma } from '@/lib/db';
import { handler, ok, notFound, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { parseMultipart, moveUploaded, discardUploads } from '@/lib/upload';
import { publicUrl } from '@/lib/storage';
import { audit } from '@/lib/audit';

// POST /api/v1/admin/media/:id/subtitles — déposer un fichier de sous-titres WebVTT (champ "subtitles")
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  const { files } = await parseMultipart(req, { maxFileBytes: 5 * 1024 * 1024, allowedFields: ['subtitles'] });
  const f = files.find((x) => x.field === 'subtitles');
  if (!f || !f.name.toLowerCase().endsWith('.vtt')) {
    await discardUploads(files);
    throw new ApiError(415, 'Fichier WebVTT (.vtt) attendu.', 'FORMAT_NON_SUPPORTE');
  }
  const rel = await moveUploaded(f, 'subtitles', `${media.id}.vtt`);
  await prisma.media.update({ where: { id: media.id }, data: { subtitlesPath: rel } });
  await audit({ actorId: admin.id, action: 'MEDIA_SUBTITLES_UPDATE', entity: 'Media', entityId: media.id });
  return ok({ subtitlesUrl: publicUrl(rel) });
});
