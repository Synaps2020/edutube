import { MemoryLearning } from './memory-learning';
import { Learning } from '../src/application/learning';
import type { Account, Session } from '../src/domain/account';
import type { PublishedCourse, LessonContent, LearningPath } from '../src/domain/catalog';
import type {
  AccountRepository,
  CatalogRepository,
  QuizRepository,
} from '../src/application/ports';
import { DomainError } from '../src/domain/errors';
import { Catalog } from '../src/application/catalog';
import { Authentication } from '../src/application/authentication';
import { Exercises } from '../src/application/exercises';
import { passwords, tokens } from '../src/adapters/security/credentials';
export const course: PublishedCourse = {
  id: 'geometry',
  slug: 'geometry',
  title: 'Les triangles',
  shortDescription: 'Comprendre les triangles.',
  description: 'Un cours de géométrie.',
  subject: { id: 'maths', code: 'MATH', name: 'Mathématiques' },
  schoolLevel: 'MIDDLE',
  instructor: { id: 'teacher', displayName: 'Moussa Ndiaye', avatarUrl: null },
  durationMinutes: 20,
  lessonCount: 2,
  rating: { average: null, reviewCount: 0, enrollmentCount: 0 },
  cover: { imageUrl: null, alt: 'Triangles', illustration: 'geometry', palette: 'blue' },
  featured: true,
  publishedAt: '2026-10-14T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
  revision: 1,
  outcomes: ['Comprendre une figure'],
  prerequisites: [],
  language: 'fr',
  lessons: [
    {
      id: 'geometry-1',
      courseId: 'geometry',
      title: 'Observer',
      order: 0,
      kind: 'READING',
      estimatedMinutes: 10,
      previewAllowed: true,
      resourceCount: 0,
    },
    {
      id: 'geometry-2',
      courseId: 'geometry',
      title: 'Calculer',
      order: 1,
      kind: 'READING',
      estimatedMinutes: 10,
      previewAllowed: false,
      resourceCount: 0,
    },
  ],
};
export class MemoryAccounts implements AccountRepository {
  accounts = new Map<string, Account>();
  sessions = new Map<string, Session>();
  async findByEmail(email: string) {
    return this.accounts.get(email) ?? null;
  }
  async create(account: Account) {
    if (this.accounts.has(account.email)) {
      throw new DomainError('CONFLICT', 'Adresse déjà utilisée.');
    }
    this.accounts.set(account.email, account);
  }
  async saveSession(session: Session) {
    this.sessions.set(session.tokenHash, session);
  }
  async findSession(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
}
export const catalogRepository: CatalogRepository = {
  async getCourses(ids) {
    return ids.includes(course.id) ? [course] : [];
  },
  async lessonCourse(lessonId) {
    return course.lessons.some((lesson) => lesson.id === lessonId) ? course.id : null;
  },
  async listCourses(search) {
    const {
      revision: _revision,
      description: _description,
      outcomes: _outcomes,
      prerequisites: _prerequisites,
      language: _language,
      lessons: _lessons,
      ...summary
    } = course;
    return {
      items: [summary],
      pagination: { page: search.page, pageSize: search.pageSize, total: 1, totalPages: 1 },
    };
  },
  async getCourse(id) {
    return id === course.id ? course : null;
  },
  async getLesson(courseId, lessonId): Promise<LessonContent | null> {
    const lesson = course.lessons.find(
      (item) => item.id === lessonId && item.courseId === courseId,
    );
    return lesson
      ? {
          lesson,
          revision: 1,
          blocks: [{ type: 'PARAGRAPH', text: 'Observer une figure.' }],
          resources: [],
        }
      : null;
  },
  async listPaths(search) {
    return {
      items: [],
      pagination: { page: search.page, pageSize: search.pageSize, total: 0, totalPages: 0 },
    };
  },
  async getPath(): Promise<LearningPath | null> {
    return null;
  },
  async subjects() {
    return [course.subject];
  },
};
export const quizRepository: QuizRepository = {
  async findByCourse() {
    return null;
  },
  async find() {
    return null;
  },
  async saveAttempt(_accountId, _quizId, _key, _fingerprint, result) {
    return result;
  },
};
export function serverOptions() {
  const accounts = new MemoryAccounts();
  return {
    accounts,
    options: {
      catalog: new Catalog(catalogRepository),
      learning: new Learning(new MemoryLearning(), catalogRepository),
      authentication: new Authentication(accounts, passwords, tokens),
      exercises: new Exercises(quizRepository),
      origin: 'http://localhost:3082',
      secureCookie: false,
      ready: async () => undefined,
    },
  };
}
