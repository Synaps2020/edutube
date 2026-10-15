import type { TeachingContent, TeachingCourse, TeachingSummary } from '@edutube/contracts/teaching';
import type { Account } from '../domain/account';
import { requireTeacher, validateTeaching } from '../domain/teaching';
export interface TeachingRepository {
  list(accountId: string): Promise<TeachingSummary[]>;
  get(accountId: string, courseId: string): Promise<TeachingCourse>;
  create(account: Account, content: TeachingContent): Promise<TeachingCourse>;
  save(
    accountId: string,
    courseId: string,
    content: TeachingContent,
    revision: number,
  ): Promise<TeachingCourse>;
  status(
    accountId: string,
    courseId: string,
    status: TeachingCourse['status'],
    revision: number,
  ): Promise<TeachingCourse>;
}
export class Teaching {
  constructor(private repository: TeachingRepository) {}
  list(account: Account) {
    requireTeacher(account);
    return this.repository.list(account.id);
  }
  get(account: Account, courseId: string) {
    requireTeacher(account);
    return this.repository.get(account.id, courseId);
  }
  create(account: Account, content: TeachingContent) {
    requireTeacher(account);
    validateTeaching(content);
    return this.repository.create(account, content);
  }
  save(account: Account, courseId: string, content: TeachingContent, revision: number) {
    requireTeacher(account);
    validateTeaching(content);
    return this.repository.save(account.id, courseId, content, revision);
  }
  status(account: Account, courseId: string, status: TeachingCourse['status'], revision: number) {
    requireTeacher(account);
    return this.repository.status(account.id, courseId, status, revision);
  }
}
