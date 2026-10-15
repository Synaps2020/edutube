import { Readable } from 'node:stream';
import type { VideoStorage } from '../../application/video-storage';
export class WebdavVideos implements VideoStorage {
  readonly driver = 'webdav';
  constructor(
    private baseUrl: string,
    private authorization: string,
  ) {
    const url = new URL(baseUrl);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('Adresse WebDAV invalide.');
    }
  }
  private url(key: string) {
    return this.baseUrl.replace(/\/$/, '') + '/' + key.split('/').map(encodeURIComponent).join('/');
  }
  private async request(key: string, options: RequestInit & { duplex?: 'half' } = {}) {
    const response = await fetch(this.url(key), {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(options.method === 'PUT' ? 900000 : 60000),
      headers: { ...options.headers, Authorization: this.authorization },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Le stockage WebDAV a refusé la demande (${response.status}).`);
    }
    return response;
  }
  async ready() {
    await (await this.request('', { method: 'PROPFIND', headers: { Depth: '0' } })).body?.cancel();
  }
  async write(key: string, source: Readable, size: number, mediaType: string) {
    const parts = key.split('/');
    for (let index = 1; index < parts.length; index++) {
      const response = await fetch(this.url(parts.slice(0, index).join('/')), {
        method: 'MKCOL',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: this.authorization },
      });
      await response.body?.cancel();
      if (!response.ok && response.status !== 405) {
        throw new Error('Le dossier WebDAV ne peut pas être créé.');
      }
    }
    await (
      await this.request(key, {
        method: 'PUT',
        headers: { 'Content-Length': String(size), 'Content-Type': mediaType },
        body: source as unknown as RequestInit['body'],
        duplex: 'half',
      })
    ).body?.cancel();
  }
  async read(key: string, range?: { start: number; length: number }) {
    const response = await this.request(key, {
      headers: range ? { Range: `bytes=${range.start}-${range.start + range.length - 1}` } : {},
    });
    if (range && response.status !== 206) {
      await response.body?.cancel();
      throw new Error('Ce stockage ne prend pas en charge la lecture partielle.');
    }
    if (!response.body) {
      throw new Error('Le stockage a renvoyé un contenu vide.');
    }
    return Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  }
  async remove(key: string) {
    await (await this.request(key, { method: 'DELETE' })).body?.cancel();
  }
}
