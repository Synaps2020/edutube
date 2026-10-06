import path from 'path';
import { prisma } from '@/lib/db';
import { handler, ok, notFound, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { parseMultipart, moveUploaded, discardUploads } from '@/lib/upload';
import { ALLOWED_IMAGE_MIME, mimeMatches, publicUrl, removeRel } from '@/lib/storage';
import { audit } from '@/lib/audit';

// POST /api/v1/admin/media/:id/thumbnail — remplacer la miniature (multipart, champ "thumbnail")
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw notFound();
  const { files } = await parseMultipart(req, { maxFileBytes: 10 * 1024 * 1024, allowedFields: ['thumbnail'] });
  const f = files.find((x) => x.field === 'thumbnail');
  if (!f || !mimeMatches(f.mime, ALLOWED_IMAGE_MIME)) {
    await discardUploads(files);
    throw new ApiError(415, 'Image JPEG, PNG ou WebP attendue.', 'FORMAT_NON_SUPPORTE');
  }
  await removeRel(media.thumbnailPath);
  const rel = await moveUploaded(f, 'thumbs', `${media.id}${path.extname(f.name) || '.jpg'}`);
  await prisma.media.update({ where: { id: media.id }, data: { thumbnailPath: rel } });
  await audit({ actorId: admin.id, action: 'MEDIA_THUMBNAIL_UPDATE', entity: 'Media', entityId: media.id });
  return ok({ thumbnailUrl: `${publicUrl(rel)}?v=${Date.now()}` });
});
