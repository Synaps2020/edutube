import type { Configuration } from '../../config/environment';
import { MinioVideos } from './minio-videos';
import { WebdavVideos } from './webdav-videos';
import { VideoStorages } from '../../application/video-storage';

export function configuredVideoStorages(config: Configuration['videos']) {
  // Les anciens fournisseurs restent disponibles pour leurs vidéos existantes.
  const stores: ConstructorParameters<typeof VideoStorages>[0] = [
    new MinioVideos(config.minio, config.minio.bucket),
  ];
  if (config.webdav) {
    const webdav = config.webdav;
    const authorization = webdav.token
      ? `Bearer ${webdav.token}`
      : `Basic ${Buffer.from(`${webdav.user}:${webdav.password}`).toString('base64')}`;
    stores.push(new WebdavVideos(webdav.url, authorization));
  }
  return new VideoStorages(stores, config.driver);
}
