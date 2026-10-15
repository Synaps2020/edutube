import { Readable } from 'node:stream';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { idSchema } from '@edutube/contracts';
import {
  resourceUploadSchema,
  resourceRemoveSchema,
  resourceLimit,
} from '@edutube/contracts/resources';
import { operations, type Operation } from '@edutube/contracts/operations';
import type { Resources } from '../../application/resources';
import type { Session } from '../../domain/account';
import { requireTeacher } from '../../domain/teaching';
import { DomainError } from '../../domain/errors';
type Route = (
  operation: Operation,
  handler: (
    request: FastifyRequest,
    session: Session | null,
    reply: FastifyReply,
  ) => Promise<unknown>,
) => void;
const params = (request: FastifyRequest) => {
  const values = z.record(idSchema).parse(request.params);
  if (values.resourceId) {
    z.string().uuid().parse(values.resourceId);
  }
  return values;
};
async function documentInput(request: FastifyRequest) {
  if (!request.isMultipart()) {
    throw new DomainError('VALIDATION_ERROR', 'Choisissez un document à joindre.');
  }
  const fields: Record<string, unknown> = {};
  let file: { fileName: string; bytes: Uint8Array } | undefined;
  for await (const part of request.parts({
    limits: {
      fileSize: resourceLimit,
      files: 1,
      fields: 2,
      parts: 3,
      fieldSize: 1000,
      fieldNameSize: 40,
    },
  })) {
    if (part.type === 'file') {
      if (part.fieldname !== 'file' || file) {
        throw new DomainError('VALIDATION_ERROR', 'Joignez un seul document dans le champ prévu.');
      }
      file = { fileName: part.filename, bytes: await part.toBuffer() };
    } else {
      if (part.fieldname in fields || part.valueTruncated) {
        throw new DomainError('VALIDATION_ERROR', 'Le formulaire du document est invalide.');
      }
      fields[part.fieldname] = part.value;
    }
  }
  if (!file) {
    throw new DomainError('VALIDATION_ERROR', 'Choisissez un document à joindre.');
  }
  if (typeof fields.expectedRevision === 'string') {
    fields.expectedRevision = Number(fields.expectedRevision);
  }
  return { file, input: resourceUploadSchema.parse(fields) };
}
export function resourceRoutes(route: Route, resources: Resources) {
  route(operations.resources, async (request, session) =>
    resources.list(params(request).courseId, params(request).lessonId, session?.account ?? null),
  );
  route(operations.download, async (request, session, reply) => {
    const result = await resources.download(params(request).resourceId, session?.account ?? null);
    reply
      .header('Content-Type', result.resource.mediaType)
      .header('Content-Length', result.resource.sizeBytes)
      .header(
        'Content-Disposition',
        `attachment; filename="document.${result.resource.mediaType === 'application/pdf' ? 'pdf' : 'txt'}"; filename*=UTF-8''${encodeURIComponent(result.resource.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      )
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .header('Accept-Ranges', 'none');
    return Readable.from(result.stream);
  });
  route(operations.teachingResources, async (request, session) =>
    resources.listForTeacher(session!.account, params(request).courseId, params(request).lessonId),
  );
  route(operations.uploadResource, async (request, session) => {
    requireTeacher(session!.account);
    const target = params(request);
    await resources.listForTeacher(session!.account, target.courseId, target.lessonId);
    const key = z.string().min(1).max(200).parse(request.headers['idempotency-key']);
    const { file, input } = await documentInput(request);
    return resources.upload(session!.account, target.courseId, target.lessonId, input, file, key);
  });
  route(operations.removeResource, async (request, session) => {
    const target = params(request);
    const input = resourceRemoveSchema.parse(request.body);
    return resources.remove(
      session!.account,
      target.courseId,
      target.lessonId,
      target.resourceId,
      input.expectedRevision,
    );
  });
}
