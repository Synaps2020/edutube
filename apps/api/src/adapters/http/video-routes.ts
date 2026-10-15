import type { Administration } from '../../application/administration';
import { createWriteStream } from 'node:fs';
import { mkdtemp, open, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { operations } from '@edutube/contracts/operations';
import { videoLimit, videoMutationSchema } from '@edutube/contracts/videos';
import type { RouteRegistrar } from './learning-routes';
import type { Videos } from '../../application/videos';
import type { ChapterAccess } from '../../application/chapter-access';
import { DomainError } from '../../domain/errors';
import { requireTeacher } from '../../domain/teaching';
const params = z.object({
  courseId: z.string().regex(/^[\w-]{1,100}$/),
  lessonId: z.string().regex(/^[\w-]{1,100}$/),
  assetName: z
    .string()
    .regex(/^(master|[01])\.m3u8$|^[01]-\d{5}\.ts$|^poster\.jpg$/)
    .optional(),
});
export function videoRoutes(
  route: RouteRegistrar,
  videos: Videos,
  access: ChapterAccess,
  administration?: Administration,
) {
  if (administration) {
    route(operations.adminVideo, async (request, session) => {
      const target = params.parse(request.params);
      await administration.readMedia(
        { actor: session!.account, requestId: request.id },
        `${target.courseId}/${target.lessonId}`,
      );
      return videos.reviewPlayback(target.courseId, target.lessonId, session!.account);
    });
  }
  route(operations.lessonAccess, async (request, session) =>
    access.state(
      z.object({ courseId: z.string() }).parse(request.params).courseId,
      session?.account ?? null,
    ),
  );
  route(operations.teachingVideo, async (request, session) => {
    const target = params.parse(request.params);
    return videos.teacher(session!.account, target.courseId, target.lessonId);
  });
  route(operations.video, async (request, session) => {
    const target = params.parse(request.params);
    return videos.playback(target.courseId, target.lessonId, session?.account ?? null);
  });
  for (const operation of [
    operations.videoFile,
    ...(administration ? [operations.adminVideoFile] : []),
  ]) {
    route(operation, async (request, session, reply) => {
      const target = params.parse(request.params);
      const review = operation === operations.adminVideoFile;
      if (review) {
        await administration!.readMedia(
          { actor: session!.account, requestId: request.id },
          `${target.courseId}/${target.lessonId}/${target.assetName}`,
        );
      }
      const result = review
        ? await videos.reviewFile(
            target.courseId,
            target.lessonId,
            target.assetName!,
            session!.account,
            request.headers.range,
          )
        : await videos.file(
            target.courseId,
            target.lessonId,
            target.assetName!,
            session?.account ?? null,
            request.headers.range,
          );
      reply.header('Content-Type', result.asset.mediaType).header('Accept-Ranges', 'bytes');
      if (result.invalidRange) {
        reply.code(416).header('Content-Range', `bytes */${result.asset.sizeBytes}`);
        return Readable.from([]);
      }
      reply.header('Content-Length', result.range?.length ?? result.asset.sizeBytes);
      if (result.range) {
        reply
          .code(206)
          .header(
            'Content-Range',
            `bytes ${result.range.start}-${result.range.end}/${result.asset.sizeBytes}`,
          );
      }
      reply.raw.once('close', () => {
        if (!reply.raw.writableFinished) {
          result.stream?.destroy();
        }
      });
      return result.stream;
    });
  }
  route(operations.removeVideo, async (request, session) => {
    const target = params.parse(request.params);
    return videos.remove(
      session!.account,
      target.courseId,
      target.lessonId,
      videoMutationSchema.parse(request.body).expectedRevision,
    );
  });
  route(operations.uploadVideo, async (request, session) => {
    requireTeacher(session!.account);
    const target = params.parse(request.params);
    await videos.teacher(session!.account, target.courseId, target.lessonId);
    const key = z.string().min(1).max(200).parse(request.headers['idempotency-key']);
    const directory = await mkdtemp(join(tmpdir(), 'edutube-upload-'));
    const path = join(directory, 'source.mp4');
    try {
      const fields: Record<string, unknown> = {};
      let fileName: string | undefined;
      let hash: string | undefined;
      for await (const part of request.parts({
        limits: {
          fileSize: videoLimit,
          files: 1,
          fields: 1,
          parts: 2,
          fieldSize: 100,
          fieldNameSize: 40,
        },
      })) {
        if (part.type === 'file') {
          if (
            part.fieldname !== 'file' ||
            fileName ||
            !part.filename.toLowerCase().endsWith('.mp4')
          ) {
            part.file.resume();
            throw new DomainError('VALIDATION_ERROR', 'Choisissez une seule vidéo MP4.');
          }
          fileName = z.string().min(1).max(200).parse(part.filename.split(/[\\/]/).pop());
          const digest = createHash('sha256');
          await pipeline(
            part.file,
            new Transform({
              transform(chunk: Buffer, _encoding, callback) {
                digest.update(chunk);
                callback(null, chunk);
              },
            }),
            createWriteStream(path, { flags: 'wx', mode: 0o600 }),
          );
          if (part.file.truncated) {
            throw new DomainError('TOO_LARGE', 'La vidéo dépasse 1 Go.');
          }
          hash = digest.digest('hex');
        } else {
          if (part.fieldname in fields || part.valueTruncated) {
            throw new DomainError('VALIDATION_ERROR', 'Le formulaire vidéo est invalide.');
          }
          fields[part.fieldname] = Number(part.value);
        }
      }
      if (!fileName || !hash) {
        throw new DomainError('VALIDATION_ERROR', 'Choisissez une vidéo à joindre.');
      }
      const descriptor = await open(path, 'r');
      const header = Buffer.alloc(12);
      try {
        await descriptor.read(header, 0, 12, 0);
      } finally {
        await descriptor.close();
      }
      if (header.toString('ascii', 4, 8) !== 'ftyp') {
        throw new DomainError('VALIDATION_ERROR', 'Ce fichier n’est pas une vidéo MP4.');
      }
      return await videos.upload(
        session!.account,
        target.courseId,
        target.lessonId,
        videoMutationSchema.parse(fields).expectedRevision,
        key,
        { path, fileName, size: (await stat(path)).size, hash },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
