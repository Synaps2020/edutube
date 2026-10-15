import type { StudyState } from '../domain/study';
import type { EnrollmentViewDto, CourseProgressDto } from '@edutube/contracts';
import type { Course, CourseSummary, Enrollment, LearningPath } from '../domain/course';
export interface CatalogRepository {
  getCourse(id: string): Promise<Course>;
  getCourses(): Promise<CourseSummary[]>;
  getPaths(): Promise<LearningPath[]>;
}
export interface LearningRepository {
  read(): Enrollment[];
  save(enrollments: Enrollment[]): void;
}
export interface StudyRepository {
  read(): StudyState;
  save(state: StudyState): void;
}

export interface LearningAccess {
  list(signal?: AbortSignal): Promise<EnrollmentViewDto[]>;
  enroll(courseId: string): Promise<EnrollmentViewDto>;
  enrollPath(pathId: string): Promise<EnrollmentViewDto[]>;
  complete(courseId: string, lessonId: string, completed: boolean): Promise<CourseProgressDto>;
}
