import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type { VideoStorage } from '../../application/video-storage';
export class MinioVideos implements VideoStorage {
  readonly driver = 'minio';
  private client: S3Client;
  constructor(
    options: { endpoint: string; accessKey: string; secretKey: string; region: string },
    private bucket: string,
  ) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: true,
      maxAttempts: 3,
      requestHandler: { connectionTimeout: 5000, socketTimeout: 60000 },
      credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  close() {
    this.client.destroy();
  }
  async ready() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        '$metadata' in error &&
        (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
      ) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        } catch (conflict) {
          await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })).catch(() => {
            throw conflict;
          });
        }
      } else {
        throw error;
      }
    }
  }
  async write(key: string, source: Readable, size: number, mediaType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: source,
        ContentLength: size,
        ContentType: mediaType,
      }),
    );
  }
  async read(key: string, range?: { start: number; length: number }) {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(range ? { Range: `bytes=${range.start}-${range.start + range.length - 1}` } : {}),
      }),
    );
    if (!(result.Body instanceof Readable)) {
      throw new Error('Le stockage vidéo a renvoyé un contenu vide.');
    }
    return result.Body;
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
