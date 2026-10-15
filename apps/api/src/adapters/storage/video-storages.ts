import { z } from 'zod';
import { MinioVideos } from './minio-videos';
import { WebdavVideos } from './webdav-videos';
import { VideoStorages } from '../../application/video-storage';
export function configuredVideoStorages(environment: NodeJS.ProcessEnv = process.env) {
  const config = z
    .object({
      VIDEO_STORAGE: z.enum(['minio', 'webdav']).default('minio'),
      MINIO_ENDPOINT: z.string().url().default('http://127.0.0.1:9040'),
      MINIO_ACCESS_KEY: z.string().default('edutube-local'),
      MINIO_SECRET_KEY: z.string().min(8).default('edutube-local-secret'),
      MINIO_BUCKET: z.string().default('edutube-videos'),
      MINIO_REGION: z.string().default('us-east-1'),
      WEBDAV_URL: z.string().url().optional(),
      WEBDAV_TOKEN: z.string().optional(),
      WEBDAV_USER: z.string().optional(),
      WEBDAV_PASSWORD: z.string().optional(),
    })
    .parse(Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== '')));
  const minio = new MinioVideos(
    {
      endpoint: config.MINIO_ENDPOINT,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
      region: config.MINIO_REGION,
    },
    config.MINIO_BUCKET,
  );
  const stores: ConstructorParameters<typeof VideoStorages>[0] = [minio];
  if (config.WEBDAV_URL) {
    if (!config.WEBDAV_TOKEN && (!config.WEBDAV_USER || !config.WEBDAV_PASSWORD)) {
      throw new Error('Renseignez les accès du stockage WebDAV.');
    }
    stores.push(
      new WebdavVideos(
        config.WEBDAV_URL,
        config.WEBDAV_TOKEN
          ? `Bearer ${config.WEBDAV_TOKEN}`
          : `Basic ${Buffer.from(`${config.WEBDAV_USER}:${config.WEBDAV_PASSWORD}`).toString('base64')}`,
      ),
    );
  }
  return new VideoStorages(stores, config.VIDEO_STORAGE);
}
