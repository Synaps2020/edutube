/** Accès au serveur pour le catalogue, les comptes et les outils d’apprentissage. */
import type {
  LoginInput,
  RegisterInput,
  ApiPage,
  CourseQuery,
  CourseSummaryDto,
  CourseDetailDto,
  TaxonomyDto,
  PathQuery,
  LearningPathSummaryDto,
  LearningPathDetailDto,
  EnrollmentViewDto,
  PageQuery,
  CourseProgressDto,
  PathProgressDto,
  ResumeDto,
  FavoriteDto,
  NoteDto,
  NoteSummaryDto,
  NoteInput,
  LessonContentDto,
  ResourceDto,
  QuizDto,
  QuizAttemptInput,
  QuizAttemptDto,
  QuizAttemptSummaryDto,
  DashboardDto,
  LearnerDto,
  SessionDto,
} from '@edutube/contracts';
export interface RequestContext {
  signal?: AbortSignal;
}
export interface MutationContext extends RequestContext {
  idempotencyKey: string;
}
export interface CatalogPort {
  list(query?: CourseQuery, context?: RequestContext): Promise<ApiPage<CourseSummaryDto>>;
  get(courseId: string, context?: RequestContext): Promise<CourseDetailDto>;
  taxonomy(context?: RequestContext): Promise<TaxonomyDto>;
}
export interface LearningPathPort {
  list(query?: PathQuery, context?: RequestContext): Promise<ApiPage<LearningPathSummaryDto>>;
  get(pathId: string, context?: RequestContext): Promise<LearningPathDetailDto>;
}
export interface EnrollmentPort {
  list(query?: PageQuery, context?: RequestContext): Promise<ApiPage<EnrollmentViewDto>>;
  enroll(courseId: string, context: MutationContext): Promise<EnrollmentViewDto>;
  enrollPath(
    pathId: string,
    context: MutationContext,
  ): Promise<{ pathId: string; enrollments: EnrollmentViewDto[] }>;
}
export interface ProgressPort {
  get(courseId: string, context?: RequestContext): Promise<CourseProgressDto>;
  setCompleted(
    courseId: string,
    lessonId: string,
    completed: boolean,
    context?: RequestContext,
  ): Promise<CourseProgressDto>;
  path(pathId: string, context?: RequestContext): Promise<PathProgressDto>;
  resume(context?: RequestContext): Promise<ResumeDto | null>;
  visit(courseId: string, lessonId: string, context?: RequestContext): Promise<ResumeDto>;
}
export interface FavoritePort {
  list(query?: CourseQuery, context?: RequestContext): Promise<ApiPage<FavoriteDto>>;
  save(courseId: string, context?: RequestContext): Promise<FavoriteDto>;
  remove(courseId: string, context?: RequestContext): Promise<void>;
}
export interface NotePort {
  list(query?: PageQuery, context?: RequestContext): Promise<ApiPage<NoteSummaryDto>>;
  get(lessonId: string, context?: RequestContext): Promise<NoteDto | null>;
  save(lessonId: string, input: NoteInput, context?: RequestContext): Promise<NoteDto>;
}
export interface LessonPort {
  get(courseId: string, lessonId: string, context?: RequestContext): Promise<LessonContentDto>;
  resources(courseId: string, lessonId: string, context?: RequestContext): Promise<ResourceDto[]>;
  download(
    resourceId: string,
    fallbackName: string,
    context?: RequestContext,
  ): Promise<{ blob: Blob; fileName: string }>;
}
export interface QuizPort {
  get(courseId: string, context?: RequestContext): Promise<QuizDto>;
  submit(
    quizId: string,
    input: QuizAttemptInput,
    context: MutationContext,
  ): Promise<QuizAttemptDto>;
  attempts(query?: PageQuery, context?: RequestContext): Promise<ApiPage<QuizAttemptSummaryDto>>;
}
export interface LearnerPort {
  profile(context?: RequestContext): Promise<LearnerDto>;
  session(context?: RequestContext): Promise<SessionDto>;
  dashboard(context?: RequestContext): Promise<DashboardDto>;
}

export interface AuthPort {
  login(input: LoginInput, context?: RequestContext): Promise<SessionDto>;
  register(input: RegisterInput, context?: RequestContext): Promise<SessionDto>;
  logout(context?: RequestContext): Promise<void>;
  session(context?: RequestContext): Promise<SessionDto>;
}
