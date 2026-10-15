import { randomUUID } from 'node:crypto';
import type { LearningRepository } from '../src/application/ports';
import type {
  Enrollment,
  EnrollmentTarget,
  Note,
  Resume,
  PageRequest,
} from '../src/domain/learning';
import type { CourseSearch } from '../src/domain/catalog';
import { DomainError } from '../src/domain/errors';
export class MemoryLearning implements LearningRepository {
  enrolled = new Map<string, Enrollment>();
  saved = new Map<string, { courseId: string; savedAt: string }>();
  notebookNotes = new Map<string, Note>();
  resumes = new Map<string, Resume>();
  requests = new Map<string, string>();
  private page<Data>(items: Data[], pagination: PageRequest) {
    return {
      items: items.slice(
        (pagination.page - 1) * pagination.pageSize,
        pagination.page * pagination.pageSize,
      ),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: items.length,
        totalPages: Math.ceil(items.length / pagination.pageSize),
      },
    };
  }
  async enrollmentPage(accountId: string, pagination: PageRequest) {
    return this.page(await this.enrollments(accountId), pagination);
  }
  async favoritePage(accountId: string, search: CourseSearch) {
    return this.page(await this.favorites(accountId), search);
  }
  async notebookPage(accountId: string, pagination: PageRequest) {
    return this.page(await this.notebook(accountId), pagination);
  }
  async attemptPage(_accountId: string, pagination: PageRequest) {
    return this.page([], pagination);
  }
  async counts(accountId: string) {
    const enrolled = await this.enrollments(accountId);
    return {
      enrolledCourses: enrolled.length,
      completedCourses: 0,
      completedLessons: enrolled.reduce((total, item) => total + item.completedLessonIds.length, 0),
      favorites: (await this.favorites(accountId)).length,
      notes: (await this.notebook(accountId)).length,
      attemptedQuizzes: 0,
    };
  }
  async enroll(accountId: string, target: EnrollmentTarget, key: string) {
    const request = `${accountId}:${target.kind}:${key}`;
    if (this.requests.has(request) && this.requests.get(request) !== target.id) {
      throw new DomainError('CONFLICT', 'Demande déjà utilisée.');
    }
    this.requests.set(request, target.id);
    return target.courseIds.map((courseId) => {
      const id = `${accountId}:${courseId}`;
      if (!this.enrolled.has(id)) {
        this.enrolled.set(id, {
          id: randomUUID(),
          courseId,
          enrolledAt: new Date().toISOString(),
          completedAt: null,
          updatedAt: new Date().toISOString(),
          completedLessonIds: [],
        });
      }
      return this.enrolled.get(id)!;
    });
  }
  async enrollment(accountId: string, courseId: string) {
    return this.enrolled.get(`${accountId}:${courseId}`) ?? null;
  }
  async enrollments(accountId: string) {
    return [...this.enrolled.entries()]
      .filter(([key]) => key.startsWith(accountId + ':'))
      .map(([, value]) => value);
  }
  async complete(accountId: string, courseId: string, lessonId: string, completed: boolean) {
    const [record] = await this.enroll(
      accountId,
      { kind: 'COURSE', id: courseId, courseIds: [courseId] },
      courseId,
    );
    record.completedLessonIds = completed
      ? [...new Set([...record.completedLessonIds, lessonId])]
      : record.completedLessonIds.filter((id) => id !== lessonId);
    record.updatedAt = new Date().toISOString();
    return record;
  }
  async favorites(accountId: string) {
    return [...this.saved.entries()]
      .filter(([key]) => key.startsWith(accountId + ':'))
      .map(([, value]) => value);
  }
  async saveFavorite(accountId: string, courseId: string) {
    const key = `${accountId}:${courseId}`;
    if (!this.saved.has(key)) {
      this.saved.set(key, { courseId, savedAt: new Date().toISOString() });
    }
    return this.saved.get(key)!;
  }
  async deleteFavorite(accountId: string, courseId: string) {
    this.saved.delete(`${accountId}:${courseId}`);
  }
  async notes(accountId: string) {
    return [...this.notebookNotes.entries()]
      .filter(([key]) => key.startsWith(accountId + ':'))
      .map(([, value]) => value);
  }
  async notebook(accountId: string) {
    return (await this.notes(accountId))
      .filter((note) => note.text.trim())
      .map((note) => ({
        ...note,
        courseTitle: 'Les triangles',
        lessonTitle: 'Observer',
        subject: { id: 'maths', code: 'MATH', name: 'Mathématiques' },
      }));
  }
  async note(accountId: string, lessonId: string) {
    return this.notebookNotes.get(`${accountId}:${lessonId}`) ?? null;
  }
  async saveNote(
    accountId: string,
    courseId: string,
    lessonId: string,
    text: string,
    expectedVersion: number | null,
  ) {
    const current = await this.note(accountId, lessonId);
    if ((current?.version ?? null) !== expectedVersion) {
      if (current?.text === text) {
        return current;
      }
      throw new DomainError('REVISION_CONFLICT', 'Note modifiée ailleurs.');
    }
    const note = {
      id: current?.id ?? randomUUID(),
      courseId,
      lessonId,
      text,
      version: (current?.version ?? 0) + 1,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.notebookNotes.set(`${accountId}:${lessonId}`, note);
    return note;
  }
  async resume(accountId: string) {
    return this.resumes.get(accountId) ?? null;
  }
  async visit(accountId: string, courseId: string, lessonId: string) {
    const resume = { courseId, lessonId, visitedAt: new Date().toISOString() };
    this.resumes.set(accountId, resume);
    return resume;
  }
  async attempts() {
    return [];
  }
}
