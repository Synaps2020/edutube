import { createHash, randomUUID } from 'node:crypto';
import type { ResourceUpload, TeachingResources } from '@edutube/contracts/resources';
import type { Account } from '../domain/account';
import type { ChapterAccess, StoredResource, Resource } from '../domain/resources';
import { allowResourceAccess, validateDocument } from '../domain/resources';
import { requireTeacher } from '../domain/teaching';
import { DomainError } from '../domain/errors';
export interface ResourceRepository {
  chapter(courseId: string, lessonId: string): Promise<ChapterAccess | null>;
  list(courseId: string, lessonId: string, authenticated: boolean): Promise<Resource[]>;
  find(resourceId: string): Promise<(StoredResource & { chapter: ChapterAccess }) | null>;
  teacherList(accountId: string, courseId: string, lessonId: string): Promise<TeachingResources>;
  add(
    accountId: string,
    resource: StoredResource,
    input: ResourceUpload,
    key: string,
    fingerprint: string,
  ): Promise<{ view: TeachingResources; inserted: boolean }>;
  remove(
    accountId: string,
    courseId: string,
    lessonId: string,
    resourceId: string,
    revision: number,
  ): Promise<TeachingResources>;
}
export interface ResourceStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  open(key: string): Promise<AsyncIterable<Uint8Array>>;
  discard(key: string): Promise<void>;
}
export class Resources {
  constructor(
    private repository: ResourceRepository,
    private storage: ResourceStorage,
  ) {}
  async list(courseId: string, lessonId: string, account: Account | null) {
    const chapter = await this.repository.chapter(courseId, lessonId);
    if (!chapter) {
      throw new DomainError('NOT_FOUND', 'Ce chapitre est introuvable.');
    }
    allowResourceAccess(chapter, !!account);
    return this.repository.list(courseId, lessonId, !!account);
  }
  async download(resourceId: string, account: Account | null) {
    const resource = await this.repository.find(resourceId);
    if (!resource) {
      throw new DomainError('NOT_FOUND', 'Ce document est introuvable.');
    }
    const teacher =
      account &&
      (account.role === 'TEACHER' || account.role === 'ADMIN') &&
      resource.chapter.ownerId === account.id;
    if (!teacher) {
      allowResourceAccess(resource.chapter, !!account);
    }
    return { resource, stream: await this.storage.open(resource.storageKey) };
  }
  listForTeacher(account: Account, courseId: string, lessonId: string) {
    requireTeacher(account);
    return this.repository.teacherList(account.id, courseId, lessonId);
  }
  async upload(
    account: Account,
    courseId: string,
    lessonId: string,
    input: ResourceUpload,
    file: { fileName: string; bytes: Uint8Array },
    key: string,
  ) {
    requireTeacher(account);
    await this.repository.teacherList(account.id, courseId, lessonId);
    const mediaType = validateDocument(file.fileName, file.bytes);
    const resource: StoredResource = {
      id: randomUUID(),
      storageKey: randomUUID(),
      courseId,
      lessonId,
      title: input.title,
      fileName: file.fileName,
      mediaType,
      sizeBytes: file.bytes.length,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([courseId, lessonId, input.title, file.fileName, mediaType]))
      .update(file.bytes)
      .digest('hex');
    await this.storage.put(resource.storageKey, file.bytes);
    try {
      const result = await this.repository.add(account.id, resource, input, key, fingerprint);
      if (!result.inserted) {
        await this.storage.discard(resource.storageKey);
      }
      return result.view;
    } catch (error) {
      await this.storage.discard(resource.storageKey);
      throw error;
    }
  }
  remove(
    account: Account,
    courseId: string,
    lessonId: string,
    resourceId: string,
    revision: number,
  ) {
    requireTeacher(account);
    return this.repository.remove(account.id, courseId, lessonId, resourceId, revision);
  }
}
