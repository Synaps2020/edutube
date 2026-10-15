import type { CatalogRepository } from './ports';
import type { CourseSearch, PathSearch } from '../domain/catalog';
import { DomainError } from '../domain/errors';
export class Catalog {
  constructor(private repository: CatalogRepository) {}
  listCourses(search: CourseSearch) {
    return this.repository.listCourses(search);
  }
  async listPaths(search: PathSearch) {
    const page = await this.repository.listPaths(search);
    return {
      ...page,
      items: page.items.map(({ revision: _revision, steps: _steps, ...summary }) => summary),
    };
  }
  subjects() {
    return this.repository.subjects();
  }
  async course(id: string) {
    const course = await this.repository.getCourse(id);
    if (!course) {
      throw new DomainError('NOT_FOUND', 'Ce cours est introuvable.');
    }
    return course;
  }
  async path(id: string) {
    const path = await this.repository.getPath(id);
    if (!path) {
      throw new DomainError('NOT_FOUND', 'Ce parcours est introuvable.');
    }
    return path;
  }
  async lesson(courseId: string, lessonId: string, authenticated: boolean) {
    const content = await this.repository.getLesson(courseId, lessonId);
    if (!content) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable.');
    }
    if (!content.lesson.previewAllowed && !authenticated) {
      throw new DomainError('UNAUTHENTICATED', 'Connectez-vous pour accéder à ce chapitre.');
    }
    return content;
  }
}
