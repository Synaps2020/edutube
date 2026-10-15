import type {
  Enrollment,
  EnrollmentTarget,
  Note,
  NotebookNote,
  Resume,
  PageRequest,
  LearningCounts,
} from '../domain/learning';
import type { Quiz } from '../domain/quiz';
import type { QuizAttemptDto, QuizAttemptSummaryDto } from '@edutube/contracts';
import type { Account, Session } from '../domain/account';
import type {
  CourseSearch,
  PathSearch,
  CourseSummary,
  PublishedCourse,
  Page,
  LearningPath,
  LessonContent,
  Subject,
} from '../domain/catalog';
export interface CatalogRepository {
  listCourses(search: CourseSearch): Promise<Page<CourseSummary>>;
  getCourses(ids: string[]): Promise<PublishedCourse[]>;
  lessonCourse(lessonId: string): Promise<string | null>;
  getCourse(id: string): Promise<PublishedCourse | null>;
  listPaths(search: PathSearch): Promise<Page<LearningPath>>;
  getPath(id: string): Promise<LearningPath | null>;
  getLesson(courseId: string, lessonId: string): Promise<LessonContent | null>;
  subjects(): Promise<Subject[]>;
}
export interface AccountRepository {
  findByEmail(email: string): Promise<Account | null>;
  create(account: Account, welcome?: RegistrationMail): Promise<void>;
  saveSession(session: Session): Promise<void>;
  findSession(tokenHash: string): Promise<Session | null>;
  deleteSession(tokenHash: string): Promise<void>;
}
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}
export interface TokenGenerator {
  create(): string;
  digest(token: string): string;
}

export interface QuizRepository {
  findByCourse(courseId: string): Promise<Quiz | null>;
  find(id: string): Promise<Quiz | null>;
  saveAttempt(
    accountId: string,
    quizId: string,
    key: string,
    fingerprint: string,
    result: QuizAttemptDto,
  ): Promise<QuizAttemptDto>;
}

export interface LearningRepository {
  enrollmentPage(accountId: string, pagination: PageRequest): Promise<Page<Enrollment>>;
  favoritePage(
    accountId: string,
    search: CourseSearch,
  ): Promise<Page<{ courseId: string; savedAt: string }>>;
  notebookPage(accountId: string, pagination: PageRequest): Promise<Page<NotebookNote>>;
  attemptPage(accountId: string, pagination: PageRequest): Promise<Page<QuizAttemptSummaryDto>>;
  counts(accountId: string): Promise<LearningCounts>;
  enroll(accountId: string, target: EnrollmentTarget, key: string): Promise<Enrollment[]>;
  enrollment(accountId: string, courseId: string): Promise<Enrollment | null>;
  enrollments(accountId: string, courseIds: string[]): Promise<Enrollment[]>;
  complete(
    accountId: string,
    courseId: string,
    lessonId: string,
    completed: boolean,
  ): Promise<Enrollment>;
  saveFavorite(accountId: string, courseId: string): Promise<{ courseId: string; savedAt: string }>;
  deleteFavorite(accountId: string, courseId: string): Promise<void>;
  note(accountId: string, lessonId: string): Promise<Note | null>;
  saveNote(
    accountId: string,
    courseId: string,
    lessonId: string,
    text: string,
    expectedVersion: number | null,
  ): Promise<Note>;
  resume(accountId: string): Promise<Resume | null>;
  visit(accountId: string, courseId: string, lessonId: string): Promise<Resume>;
}

export interface RegistrationMail {
  tokenHash: string;
  link: string;
}
