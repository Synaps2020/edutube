import { z } from 'zod';
import {
  idSchema,
  type LoginInput,
  type RegisterInput,
  type CourseQuery,
  type PathQuery,
  type PageQuery,
  type NoteInput,
  type QuizAttemptInput,
} from '@edutube/contracts';
import { operations, type Operation } from '@edutube/contracts/operations';
import type {
  AuthPort,
  CatalogPort,
  LearningPathPort,
  EnrollmentPort,
  ProgressPort,
  FavoritePort,
  NotePort,
  LessonPort,
  QuizPort,
  LearnerPort,
  RequestContext,
  MutationContext,
} from '../../application/api/ports';
import { HttpClient } from './client';
function route(path: string, variables: Record<string, string>) {
  return path.replace(/\{(\w+)\}/g, (_match, key: string) =>
    encodeURIComponent(idSchema.parse(variables[key])),
  );
}
export function queryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params.size ? `?${params}` : '';
}
class Service {
  constructor(protected client: HttpClient) {}
  protected execute<O extends Operation>(
    operation: O,
    variables: Record<string, string> = {},
    input?: unknown,
    context: RequestContext & { idempotencyKey?: string } = {},
    query?: unknown,
  ): Promise<z.infer<O['response']>> {
    const path = route(operation.path, variables);
    const params = operation.query ? queryString(operation.query.parse(query ?? {})) : '';
    const body = operation.body ? operation.body.parse(input) : undefined;
    return this.client.request(`${path}${params}`, operation.response, {
      method: operation.method,
      body,
      ...context,
    });
  }
}
export class AuthService extends Service implements AuthPort {
  login(input: LoginInput, context: RequestContext = {}) {
    return this.execute(operations.login, {}, input, context);
  }
  register(input: RegisterInput, context: RequestContext = {}) {
    return this.execute(operations.register, {}, input, context);
  }
  logout(context: RequestContext = {}) {
    return this.execute(operations.logout, {}, undefined, context);
  }
  session(context: RequestContext = {}) {
    return this.execute(operations.session, {}, undefined, context);
  }
}
export class CatalogService extends Service implements CatalogPort {
  list(query: CourseQuery = {}, context: RequestContext = {}) {
    return this.execute(operations.courses, {}, undefined, context, query);
  }
  get(courseId: string, context: RequestContext = {}) {
    return this.execute(operations.course, { courseId }, undefined, context);
  }
  taxonomy(context: RequestContext = {}) {
    return this.execute(operations.taxonomy, {}, undefined, context);
  }
}
export class LearningPathService extends Service implements LearningPathPort {
  list(query: PathQuery = {}, context: RequestContext = {}) {
    return this.execute(operations.paths, {}, undefined, context, query);
  }
  get(pathId: string, context: RequestContext = {}) {
    return this.execute(operations.path, { pathId }, undefined, context);
  }
}
export class EnrollmentService extends Service implements EnrollmentPort {
  list(query: PageQuery = {}, context: RequestContext = {}) {
    return this.execute(operations.enrollments, {}, undefined, context, query);
  }
  enroll(courseId: string, context: MutationContext) {
    z.string().min(1).max(200).parse(context.idempotencyKey);
    return this.execute(operations.enroll, {}, { courseId }, context);
  }
  enrollPath(pathId: string, context: MutationContext) {
    z.string().min(1).max(200).parse(context.idempotencyKey);
    return this.execute(operations.enrollPath, {}, { pathId }, context);
  }
}
export class ProgressService extends Service implements ProgressPort {
  get(courseId: string, context: RequestContext = {}) {
    return this.execute(operations.progress, { courseId }, undefined, context);
  }
  setCompleted(
    courseId: string,
    lessonId: string,
    completed: boolean,
    context: RequestContext = {},
  ) {
    return this.execute(operations.complete, { courseId, lessonId }, { completed }, context);
  }
  path(pathId: string, context: RequestContext = {}) {
    return this.execute(operations.pathProgress, { pathId }, undefined, context);
  }
  resume(context: RequestContext = {}) {
    return this.execute(operations.resume, {}, undefined, context);
  }
  visit(courseId: string, lessonId: string, context: RequestContext = {}) {
    return this.execute(operations.visit, {}, { courseId, lessonId }, context);
  }
}
export class FavoriteService extends Service implements FavoritePort {
  list(query: CourseQuery = {}, context: RequestContext = {}) {
    return this.execute(operations.favorites, {}, undefined, context, query);
  }
  save(courseId: string, context: RequestContext = {}) {
    return this.execute(operations.saveFavorite, { courseId }, undefined, context);
  }
  remove(courseId: string, context: RequestContext = {}) {
    return this.execute(operations.deleteFavorite, { courseId }, undefined, context);
  }
}
export class NoteService extends Service implements NotePort {
  list(query: PageQuery = {}, context: RequestContext = {}) {
    return this.execute(operations.notes, {}, undefined, context, query);
  }
  get(lessonId: string, context: RequestContext = {}) {
    return this.execute(operations.note, { lessonId }, undefined, context);
  }
  save(lessonId: string, input: NoteInput, context: RequestContext = {}) {
    return this.execute(operations.saveNote, { lessonId }, input, context);
  }
}
export class LessonService extends Service implements LessonPort {
  get(courseId: string, lessonId: string, context: RequestContext = {}) {
    return this.execute(operations.lesson, { courseId, lessonId }, undefined, context);
  }
  resources(courseId: string, lessonId: string, context: RequestContext = {}) {
    return this.execute(operations.resources, { courseId, lessonId }, undefined, context);
  }
  download(resourceId: string, fallbackName: string, context: RequestContext = {}) {
    return this.client.download(
      route(operations.download.path, { resourceId }),
      fallbackName,
      context.signal,
    );
  }
}
export class QuizService extends Service implements QuizPort {
  get(courseId: string, context: RequestContext = {}) {
    return this.execute(operations.quiz, { courseId }, undefined, context);
  }
  submit(quizId: string, input: QuizAttemptInput, context: MutationContext) {
    z.string().min(1).max(200).parse(context.idempotencyKey);
    return this.execute(operations.attempt, { quizId }, input, context);
  }
  attempts(query: PageQuery = {}, context: RequestContext = {}) {
    return this.execute(operations.attempts, {}, undefined, context, query);
  }
}
export class LearnerService extends Service implements LearnerPort {
  profile(context: RequestContext = {}) {
    return this.execute(operations.me, {}, undefined, context);
  }
  session(context: RequestContext = {}) {
    return this.execute(operations.session, {}, undefined, context);
  }
  dashboard(context: RequestContext = {}) {
    return this.execute(operations.dashboard, {}, undefined, context);
  }
}
/** Les services partagent le même transport et les mêmes contrats. */
export function createApiServices(options: {
  baseUrl: string;
  transport?: typeof fetch;
  timeoutMs?: number;
  csrfToken?: () => string | undefined;
}) {
  const client = new HttpClient(
    options.baseUrl,
    options.transport,
    options.timeoutMs,
    options.csrfToken,
  );
  return {
    auth: new AuthService(client),
    catalog: new CatalogService(client),
    paths: new LearningPathService(client),
    enrollments: new EnrollmentService(client),
    progress: new ProgressService(client),
    favorites: new FavoriteService(client),
    notes: new NoteService(client),
    lessons: new LessonService(client),
    quizzes: new QuizService(client),
    learner: new LearnerService(client),
  };
}
