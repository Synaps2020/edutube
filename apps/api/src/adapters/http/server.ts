import { randomUUID } from 'node:crypto';
import type { Administration } from '../../application/administration';
import {
  adminQuerySchema,
  accountChangeSchema,
  accountCreateSchema,
  moderationSchema,
} from '@edutube/contracts/administration';
import { videoRoutes } from './video-routes';
import type { Videos } from '../../application/videos';
import type { ChapterAccess } from '../../application/chapter-access';
import type { Identity } from '../../application/identity';
import {
  profileInputSchema,
  emailInputSchema,
  tokenInputSchema,
  resetInputSchema,
} from '@edutube/contracts/identity';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { resourceRoutes } from './resource-routes';
import type { Resources } from '../../application/resources';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { operations, type Operation } from '@edutube/contracts/operations';
import {
  idSchema,
  sessionSchema,
  courseQuerySchema,
  pathQuerySchema,
  loginInputSchema,
  registerInputSchema,
  attemptInputSchema,
} from '@edutube/contracts';
import type { Teaching } from '../../application/teaching';
import {
  teachingContentSchema,
  teachingSaveSchema,
  teachingStatusSchema,
} from '@edutube/contracts/teaching';
import { learningRoutes } from './learning-routes';
import type { Learning } from '../../application/learning';
import type { Exercises } from '../../application/exercises';
import type { Catalog } from '../../application/catalog';
import type { Authentication } from '../../application/authentication';
import { DomainError } from '../../domain/errors';
import type { Session } from '../../domain/account';
interface ServerOptions {
  administration?: Administration;
  videos?: Videos;
  chapterAccess?: ChapterAccess;
  identity?: Identity;
  resources?: Resources;
  teaching?: Teaching;
  learning: Learning;
  exercises: Exercises;
  catalog: Catalog;
  authentication: Authentication;
  origin: string;
  secureCookie: boolean;
  ready: () => Promise<void>;
  logger?: boolean;
}
function sessionView(session: Session) {
  return sessionSchema.parse({
    learner: {
      id: session.account.id,
      role: session.account.role ?? 'LEARNER',
      displayName: session.account.displayName,
      schoolLevel: session.account.schoolLevel,
    },
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  });
}
function queryInput(query: unknown) {
  const input = z.record(z.unknown()).parse(query);
  for (const name of ['page', 'pageSize']) {
    if (typeof input[name] === 'string') {
      input[name] = Number(input[name]);
    }
  }
  if (input.featured === 'true') {
    input.featured = true;
  }
  if (input.featured === 'false') {
    input.featured = false;
  }
  return input;
}
export async function createServer(options: ServerOptions) {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logger: options.logger ?? false,
    bodyLimit: 65536,
    requestTimeout: 900000,
  });
  await app.register(cookie);
  await app.register(multipart);
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  const cookieName = 'edutube_session';
  const requestSessions = new WeakMap<FastifyRequest, Session>();
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id).header('X-Content-Type-Options', 'nosniff');
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
    }
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      if (request.headers.origin !== options.origin) {
        throw new DomainError('FORBIDDEN', 'Cette demande provient d’une adresse non autorisée.');
      }
    }
  });
  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = z.object({ statusCode: z.number() }).safeParse(error);
    const httpStatus = statusCode.success ? statusCode.data.statusCode : 500;
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Le service est momentanément indisponible.';
    let details: { field: string; message: string }[] | undefined;
    if (error instanceof DomainError) {
      code = error.code;
      status = {
        VALIDATION_ERROR: 400,
        TOO_LARGE: 413,
        NOT_FOUND: 404,
        UNAUTHENTICATED: 401,
        FORBIDDEN: 403,
        CONFLICT: 409,
        REVISION_CONFLICT: 409,
      }[error.code];
      message = error.message;
    } else if (error instanceof z.ZodError) {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = 'Vérifiez les informations saisies.';
      details = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
    } else if (httpStatus === 429) {
      status = 429;
      code = 'RATE_LIMITED';
      message = 'Trop de demandes. Réessayez dans un instant.';
    } else if (httpStatus === 413) {
      status = 413;
      code = 'TOO_LARGE';
      message = request.url.endsWith('/video')
        ? 'La vidéo dépasse la taille autorisée (1 Go).'
        : 'Le document ou le formulaire dépasse la taille autorisée (10 Mo par document).';
    } else if (httpStatus === 400 || httpStatus === 415) {
      status = httpStatus;
      code = 'VALIDATION_ERROR';
      message = 'Le contenu de cette demande est invalide.';
    } else {
      request.log.error({ err: error }, 'Erreur du serveur');
    }
    const actor = requestSessions.get(request)?.account;
    if (options.administration && actor && request.url.startsWith('/api/v1/administration/')) {
      try {
        await options.administration.rejected(
          { actor, requestId: request.id },
          `${request.method} ${request.url.split('?')[0]}`,
          code,
        );
      } catch (auditError) {
        request.log.error(
          { err: auditError },
          'Échec de l’enregistrement d’une intervention refusée',
        );
      }
    }
    reply
      .code(status)
      .send({ error: { code, message, requestId: request.id, ...(details ? { details } : {}) } });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Cette adresse est introuvable.',
        requestId: request.id,
      },
    }),
  );
  app.get('/health', async (_request, reply) => {
    try {
      await options.ready();
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  const route = (
    operation: Operation,
    handler: (
      request: FastifyRequest,
      session: Session | null,
      reply: FastifyReply,
    ) => Promise<unknown>,
  ) => {
    app.route({
      method: operation.method,
      ...(operation.path.startsWith('/teaching/') ? { bodyLimit: 1048576 } : {}),
      url: `/api/v1${operation.path.replace(/\{(\w+)\}/g, ':$1')}`,
      ...(operation.path.startsWith('/auth/') && operation.method === 'POST'
        ? { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
        : {}),
      handler: async (request, reply) => {
        const session = await options.authentication.session(request.cookies[cookieName]);
        if (session) {
          requestSessions.set(request, session);
        }
        if (operation.authenticated && !session) {
          throw new DomainError('UNAUTHENTICATED', 'Connectez-vous pour continuer.');
        }
        if (
          operation.authenticated &&
          operation.method !== 'GET' &&
          request.headers['x-csrf-token'] !== session?.csrfToken
        ) {
          throw new DomainError('FORBIDDEN', 'La session a changé. Rechargez la page.');
        }
        if (
          options.chapterAccess &&
          !operation.path.startsWith('/teaching/') &&
          !operation.path.startsWith('/administration/')
        ) {
          const target = z.record(z.string()).parse(request.params);
          if (target.courseId && target.lessonId) {
            await options.chapterAccess.assert(
              target.courseId,
              target.lessonId,
              session?.account ?? null,
            );
          } else if (target.resourceId) {
            await options.chapterAccess.assertResource(target.resourceId, session?.account ?? null);
          } else if (target.lessonId) {
            await options.chapterAccess.assertLesson(target.lessonId, session?.account ?? null);
          } else if (operation.path === '/me/resume' && operation.method !== 'GET') {
            const target = z
              .object({ courseId: z.string(), lessonId: z.string() })
              .parse(request.body);
            await options.chapterAccess.assert(
              target.courseId,
              target.lessonId,
              session?.account ?? null,
            );
          }
        }
        const data = await handler(request, session, reply);
        if (operation.binary) {
          return reply.send(data);
        }
        if (operation.status === 204) {
          return reply.code(204).send();
        }
        const checked = operation.response.safeParse(data);
        if (!checked.success) {
          throw new Error(`Réponse invalide : ${operation.path}`);
        }
        return reply.code(operation.status).send({ data: checked.data });
      },
    });
  };
  const params = (request: FastifyRequest) => z.record(idSchema).parse(request.params);
  route(operations.taxonomy, async () => ({
    subjects: await options.catalog.subjects(),
    schoolLevels: [
      { code: 'PRIMARY', label: 'Primaire' },
      { code: 'MIDDLE', label: 'Collège' },
      { code: 'SECONDARY', label: 'Lycée' },
    ],
  }));
  route(operations.courses, async (request) =>
    options.catalog.listCourses(courseQuerySchema.parse(queryInput(request.query))),
  );
  route(operations.course, async (request) => options.catalog.course(params(request).courseId));
  route(operations.paths, async (request) =>
    options.catalog.listPaths(pathQuerySchema.parse(queryInput(request.query))),
  );
  route(operations.path, async (request) => options.catalog.path(params(request).pathId));
  route({ ...operations.lesson, authenticated: false }, async (request, session) =>
    options.catalog.lesson(params(request).courseId, params(request).lessonId, session !== null),
  );
  route(operations.session, async (_request, session) => sessionView(session!));
  route(operations.me, async (_request, session) => sessionView(session!).learner);
  const setSession = (reply: FastifyReply, result: { token: string; session: Session }) => {
    reply.setCookie(cookieName, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookie,
      path: '/api',
      expires: new Date(result.session.expiresAt),
    });
    return sessionView(result.session);
  };
  route(operations.register, async (request, _session, reply) => {
    const input = registerInputSchema.parse(request.body);
    const registered = await options.authentication.register(input);
    return setSession(reply, registered);
  });
  route(operations.login, async (request, _session, reply) => {
    const input = loginInputSchema.parse(request.body);
    return setSession(reply, await options.authentication.login(input.email, input.password));
  });
  route(operations.logout, async (request, _session, reply) => {
    await options.authentication.logout(request.cookies[cookieName]!);
    reply.clearCookie(cookieName, {
      path: '/api',
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookie,
    });
  });
  route(operations.quiz, async (request) => options.exercises.get(params(request).courseId));
  route(operations.attempt, async (request, session) =>
    options.exercises.submit(
      session!.account.id,
      params(request).quizId,
      attemptInputSchema.parse(request.body),
      z.string().min(1).max(200).parse(request.headers['idempotency-key']),
    ),
  );
  if (options.teaching) {
    const teaching = options.teaching;
    route(operations.teachingCourses, async (_request, session) => teaching.list(session!.account));
    route(operations.teachingCourse, async (request, session) =>
      teaching.get(session!.account, params(request).courseId),
    );
    route(operations.teachingCreate, async (request, session) =>
      teaching.create(session!.account, teachingContentSchema.parse(request.body)),
    );
    route(operations.teachingSave, async (request, session) => {
      const { expectedRevision, ...content } = teachingSaveSchema.parse(request.body);
      return teaching.save(session!.account, params(request).courseId, content, expectedRevision);
    });
    route(operations.teachingStatus, async (request, session) => {
      const input = teachingStatusSchema.parse(request.body);
      return teaching.status(
        session!.account,
        params(request).courseId,
        input.status,
        input.expectedRevision,
      );
    });
  }
  if (options.resources) {
    resourceRoutes(route, options.resources);
  }
  if (options.identity) {
    const identity = options.identity;
    route(operations.profile, async (_request, session) => identity.profile(session!.account.id));
    route(operations.saveProfile, async (request, session) =>
      identity.saveProfile(session!.account.id, profileInputSchema.parse(request.body)),
    );
    route(operations.requestVerification, async (_request, session) =>
      identity.request({ accountId: session!.account.id }, 'VERIFY'),
    );
    route(operations.verifyEmail, async (request) =>
      identity.verify(tokenInputSchema.parse(request.body).token),
    );
    route(operations.forgotPassword, async (request) =>
      identity.request(emailInputSchema.parse(request.body), 'RESET'),
    );
    route(operations.resetPassword, async (request) => {
      const input = resetInputSchema.parse(request.body);
      return identity.reset(input.token, input.password);
    });
  }
  if (options.videos && options.chapterAccess) {
    videoRoutes(route, options.videos, options.chapterAccess, options.administration);
  }
  if (options.administration) {
    const admin = options.administration;
    const context = (request: FastifyRequest, session: Session | null) => ({
      actor: session!.account,
      requestId: request.id,
    });
    route(operations.adminOverview, async (request, session) =>
      admin.overview(context(request, session)),
    );
    route(operations.adminReview, async (request, session) =>
      admin.review(context(request, session), params(request).courseId),
    );
    route(operations.adminAccounts, async (request, session) =>
      admin.accounts(context(request, session), adminQuerySchema.parse(request.query)),
    );
    route(operations.adminCreateAccount, async (request, session) =>
      admin.createAccount(context(request, session), accountCreateSchema.parse(request.body)),
    );
    route(operations.adminChangeAccount, async (request, session) =>
      admin.changeAccount(
        context(request, session),
        z.object({ accountId: z.string().uuid() }).parse(request.params).accountId,
        accountChangeSchema.parse(request.body),
      ),
    );
    route(operations.adminCourses, async (request, session) =>
      admin.courses(context(request, session), adminQuerySchema.parse(request.query)),
    );
    route(operations.adminModerate, async (request, session) =>
      admin.moderate(
        context(request, session),
        params(request).courseId,
        moderationSchema.parse(request.body),
      ),
    );
    route(operations.adminJournal, async (request, session) =>
      admin.journal(context(request, session), adminQuerySchema.parse(request.query)),
    );
  }
  learningRoutes(route, options.learning, queryInput);
  return app;
}
