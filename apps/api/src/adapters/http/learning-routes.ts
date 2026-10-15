import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { operations, type Operation } from '@edutube/contracts/operations';
import {
  idSchema,
  pageQuerySchema,
  courseQuerySchema,
  enrollmentInputSchema,
  pathEnrollmentInputSchema,
  progressInputSchema,
  resumeInputSchema,
  noteInputSchema,
} from '@edutube/contracts';
import type { Session } from '../../domain/account';
import type { Learning } from '../../application/learning';
export type RouteRegistrar = (
  operation: Operation,
  handler: (
    request: FastifyRequest,
    session: Session | null,
    reply: FastifyReply,
  ) => Promise<unknown>,
) => void;
export function learningRoutes(
  route: RouteRegistrar,
  learning: Learning,
  parseQuery: (query: unknown) => Record<string, unknown>,
) {
  const params = (request: FastifyRequest) => z.record(idSchema).parse(request.params);
  const key = (request: FastifyRequest) =>
    z.string().min(1).max(200).parse(request.headers['idempotency-key']);
  route(operations.enrollments, async (request, session) =>
    learning.enrollments(
      session!.account.id,
      pageQuerySchema.strict().parse(parseQuery(request.query)),
    ),
  );
  route(operations.enroll, async (request, session) =>
    learning.enroll(
      session!.account.id,
      enrollmentInputSchema.parse(request.body).courseId,
      key(request),
    ),
  );
  route(operations.enrollPath, async (request, session) =>
    learning.enrollPath(
      session!.account.id,
      pathEnrollmentInputSchema.parse(request.body).pathId,
      key(request),
    ),
  );
  route(operations.progress, async (request, session) =>
    learning.progress(session!.account.id, params(request).courseId),
  );
  route(operations.complete, async (request, session) =>
    learning.complete(
      session!.account.id,
      params(request).courseId,
      params(request).lessonId,
      progressInputSchema.parse(request.body).completed,
    ),
  );
  route(operations.pathProgress, async (request, session) =>
    learning.pathProgress(session!.account.id, params(request).pathId),
  );
  route(operations.resume, async (_request, session) => learning.resume(session!.account.id));
  route(operations.visit, async (request, session) => {
    const input = resumeInputSchema.parse(request.body);
    return learning.visit(session!.account.id, input.courseId, input.lessonId);
  });
  route(operations.favorites, async (request, session) =>
    learning.favorites(session!.account.id, courseQuerySchema.parse(parseQuery(request.query))),
  );
  route(operations.saveFavorite, async (request, session) =>
    learning.saveFavorite(session!.account.id, params(request).courseId),
  );
  route(operations.deleteFavorite, async (request, session) =>
    learning.deleteFavorite(session!.account.id, params(request).courseId),
  );
  route(operations.notes, async (request, session) =>
    learning.notes(session!.account.id, pageQuerySchema.strict().parse(parseQuery(request.query))),
  );
  route(operations.note, async (request, session) =>
    learning.note(session!.account.id, params(request).lessonId),
  );
  route(operations.saveNote, async (request, session) =>
    learning.saveNote(
      session!.account.id,
      params(request).lessonId,
      noteInputSchema.parse(request.body),
    ),
  );
  route(operations.attempts, async (request, session) =>
    learning.attempts(
      session!.account.id,
      pageQuerySchema.strict().parse(parseQuery(request.query)),
    ),
  );
  route(operations.dashboard, async (_request, session) => learning.dashboard(session!.account));
}
