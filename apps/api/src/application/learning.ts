import type { LearningRepository, CatalogRepository } from './ports';
import type { CourseSearch, CourseSummary, PublishedCourse } from '../domain/catalog';
import type { Enrollment } from '../domain/learning';
import type { Account } from '../domain/account';
import { courseProgress, enrollmentView } from '../domain/learning';
import { DomainError } from '../domain/errors';
export interface Pagination {
  page: number;
  pageSize: number;
}
function summary(course: PublishedCourse): CourseSummary {
  const {
    revision: _revision,
    description: _description,
    outcomes: _outcomes,
    prerequisites: _prerequisites,
    language: _language,
    lessons: _lessons,
    ...data
  } = course;
  return data;
}
export class Learning {
  constructor(
    private repository: LearningRepository,
    private catalog: CatalogRepository,
    private now: () => string = () => new Date().toISOString(),
  ) {}
  private async course(id: string) {
    const course = await this.catalog.getCourse(id);
    if (!course) {
      throw new DomainError('NOT_FOUND', 'Ce cours est introuvable.');
    }
    return course;
  }
  private async views(enrollments: Enrollment[]) {
    const courses = await this.catalog.getCourses(enrollments.map((item) => item.courseId));
    return enrollments.flatMap((item) => {
      const course = courses.find((course) => course.id === item.courseId);
      return course ? [enrollmentView(course, item)] : [];
    });
  }
  async enrollments(accountId: string, pagination: Pagination) {
    const page = await this.repository.enrollmentPage(accountId, pagination);
    return { ...page, items: await this.views(page.items) };
  }
  async enroll(accountId: string, courseId: string, key: string) {
    await this.course(courseId);
    const enrolled = await this.repository.enroll(
      accountId,
      { kind: 'COURSE', id: courseId, courseIds: [courseId] },
      key,
    );
    return (await this.views(enrolled))[0];
  }
  async enrollPath(accountId: string, pathId: string, key: string) {
    const path = await this.catalog.getPath(pathId);
    if (!path) {
      throw new DomainError('NOT_FOUND', 'Ce parcours est introuvable.');
    }
    const records = await this.repository.enroll(
      accountId,
      { kind: 'PATH', id: pathId, courseIds: path.steps.map((step) => step.course.id) },
      key,
    );
    const views = await this.views(records);
    return {
      pathId,
      enrollments: path.steps.flatMap((step) => {
        const view = views.find((item) => item.course.id === step.course.id);
        return view ? [view] : [];
      }),
    };
  }
  async progress(accountId: string, courseId: string) {
    return courseProgress(
      await this.course(courseId),
      await this.repository.enrollment(accountId, courseId),
      this.now(),
    );
  }
  async complete(accountId: string, courseId: string, lessonId: string, completed: boolean) {
    const course = await this.course(courseId);
    if (!course.lessons.some((lesson) => lesson.id === lessonId)) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre ne fait pas partie du cours.');
    }
    const enrollment = await this.repository.complete(accountId, courseId, lessonId, completed);
    return courseProgress(course, enrollment, this.now());
  }
  async pathProgress(accountId: string, pathId: string) {
    const path = await this.catalog.getPath(pathId);
    if (!path) {
      throw new DomainError('NOT_FOUND', 'Ce parcours est introuvable.');
    }
    const courses = await this.catalog.getCourses(path.steps.map((step) => step.course.id));
    const records = await this.repository.enrollments(
      accountId,
      path.steps.map((step) => step.course.id),
    );
    const courseProgressList = path.steps.map((step) => {
      const course = courses.find((item) => item.id === step.course.id);
      if (!course) {
        throw new DomainError('CONFLICT', 'Le programme du parcours a changé.');
      }
      return courseProgress(
        course,
        records.find((item) => item.courseId === course.id) ?? null,
        this.now(),
      );
    });
    const next = courseProgressList.find((item) => item.percent < 100);
    return {
      pathId,
      percent: Math.round(
        courseProgressList.reduce((total, item) => total + item.percent, 0) /
          courseProgressList.length,
      ),
      courseProgress: courseProgressList,
      nextCourseId: next?.courseId ?? null,
      nextLessonId: next?.nextLessonId ?? null,
    };
  }
  resume(accountId: string) {
    return this.repository.resume(accountId);
  }
  async visit(accountId: string, courseId: string, lessonId: string) {
    const course = await this.course(courseId);
    if (!course.lessons.some((lesson) => lesson.id === lessonId)) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre ne fait pas partie du cours.');
    }
    return this.repository.visit(accountId, courseId, lessonId);
  }
  async favorites(accountId: string, search: CourseSearch) {
    const page = await this.repository.favoritePage(accountId, search);
    const courses = await this.catalog.getCourses(page.items.map((item) => item.courseId));
    return {
      ...page,
      items: page.items.flatMap((item) => {
        const course = courses.find((course) => course.id === item.courseId);
        return course ? [{ course: summary(course), savedAt: item.savedAt }] : [];
      }),
    };
  }
  async saveFavorite(accountId: string, courseId: string) {
    const course = await this.course(courseId);
    const saved = await this.repository.saveFavorite(accountId, courseId);
    return { course: summary(course), savedAt: saved.savedAt };
  }
  deleteFavorite(accountId: string, courseId: string) {
    return this.repository.deleteFavorite(accountId, courseId);
  }
  async notes(accountId: string, pagination: Pagination) {
    return this.repository.notebookPage(accountId, pagination);
  }
  async note(accountId: string, lessonId: string) {
    const note = await this.repository.note(accountId, lessonId);
    if (note) {
      return note;
    }
    if (!(await this.catalog.lessonCourse(lessonId))) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable.');
    }
    return null;
  }
  async saveNote(
    accountId: string,
    lessonId: string,
    input: { text: string; expectedVersion: number | null },
  ) {
    const courseId = await this.catalog.lessonCourse(lessonId);
    if (!courseId) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable.');
    }
    return this.repository.saveNote(
      accountId,
      courseId,
      lessonId,
      input.text,
      input.expectedVersion,
    );
  }
  async attempts(accountId: string, pagination: Pagination) {
    return this.repository.attemptPage(accountId, pagination);
  }
  async dashboard(account: Account) {
    const [library, counts, attempts, resume] = await Promise.all([
      this.repository.enrollmentPage(account.id, { page: 1, pageSize: 6 }),
      this.repository.counts(account.id),
      this.repository.attemptPage(account.id, { page: 1, pageSize: 6 }),
      this.repository.resume(account.id),
    ]);
    return {
      learner: {
        id: account.id,
        displayName: account.displayName,
        schoolLevel: account.schoolLevel,
      },
      counts,
      resume,
      recentEnrollments: await this.views(library.items),
      latestAttempts: attempts.items,
      generatedAt: this.now(),
    };
  }
}
