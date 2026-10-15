import { access, mkdir, open, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import type { ResourceStorage } from '../../application/resources';
import { DomainError } from '../../domain/errors';
export class ResourceFiles implements ResourceStorage {
  private directory: string;
  constructor(directory: string) {
    this.directory = resolve(directory);
  }
  async ready() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await access(this.directory, constants.R_OK | constants.W_OK);
  }
  private path(key: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
      throw new Error('Identifiant de stockage invalide.');
    }
    return join(this.directory, key);
  }
  async put(key: string, bytes: Uint8Array) {
    const path = this.path(key);
    const file = await open(path, 'wx', 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } catch (error) {
      await unlink(path);
      throw error;
    } finally {
      await file.close();
    }
  }
  async open(key: string) {
    try {
      const file = await open(this.path(key), 'r');
      return file.createReadStream();
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new DomainError('NOT_FOUND', 'Le document n’est plus disponible.');
      }
      throw error;
    }
  }
  async discard(key: string) {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
