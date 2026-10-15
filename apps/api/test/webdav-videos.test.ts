import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { WebdavVideos } from '../src/adapters/storage/webdav-videos';
describe('Contrat du branchement WebDAV', () => {
  const files = new Map<string, Buffer>();
  let endpoint: string;
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== 'Bearer test-local') {
      response.writeHead(401).end();
      return;
    }
    if (request.method === 'PROPFIND') {
      response.writeHead(207).end();
      return;
    }
    if (request.method === 'MKCOL') {
      response.writeHead(201).end();
      return;
    }
    const key = request.url!;
    if (request.method === 'PUT') {
      const parts: Buffer[] = [];
      for await (const part of request) {
        parts.push(part);
      }
      files.set(key, Buffer.concat(parts));
      response.writeHead(201).end();
      return;
    }
    if (request.method === 'DELETE') {
      files.delete(key);
      response.writeHead(204).end();
      return;
    }
    const bytes = files.get(key);
    if (!bytes) {
      response.writeHead(404).end();
      return;
    }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
    if (range) {
      response.writeHead(206).end(bytes.subarray(Number(range[1]), Number(range[2]) + 1));
    } else {
      response.end(bytes);
    }
  });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Port de test indisponible.');
    }
    endpoint = `http://127.0.0.1:${address.port}/dav`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  it('écrit, lit partiellement et retire sans dépendre de MinIO', async () => {
    const storage = new WebdavVideos(endpoint, 'Bearer test-local');
    await storage.ready();
    await storage.write('videos/clip/source.mp4', Readable.from(['0123456789']), 10, 'video/mp4');
    const chunks: Buffer[] = [];
    for await (const chunk of await storage.read('videos/clip/source.mp4', {
      start: 2,
      length: 4,
    })) {
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks).toString()).toBe('2345');
    await storage.remove('videos/clip/source.mp4');
    await expect(storage.read('videos/clip/source.mp4')).rejects.toThrow();
  });
});
