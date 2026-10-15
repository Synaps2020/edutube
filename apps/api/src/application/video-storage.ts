import type { Readable } from 'node:stream';
export interface VideoStorage {
  readonly driver: string;
  ready(): Promise<void>;
  write(key: string, source: Readable, size: number, mediaType: string): Promise<void>;
  read(key: string, range?: { start: number; length: number }): Promise<Readable>;
  remove(key: string): Promise<void>;
}
export class VideoStorages {
  constructor(
    private stores: VideoStorage[],
    readonly active: string,
  ) {}
  get(driver = this.active) {
    const storage = this.stores.find((item) => item.driver === driver);
    if (!storage) {
      throw new Error('Ce stockage vidéo n’est pas configuré.');
    }
    return storage;
  }
}
