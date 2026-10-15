import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { VideoRecord, VideoAsset } from './videos';
import type { VideoStorages } from './video-storage';
export interface VideoJob extends VideoRecord {
  processingToken: string;
}
export interface VideoJobs {
  claim(): Promise<VideoJob | null>;
  heartbeat(job: VideoJob): Promise<boolean>;
  finish(job: VideoJob, duration: number, assets: VideoAsset[]): Promise<boolean>;
  fail(job: VideoJob): Promise<void>;
}
export interface VideoEncoder {
  encode(
    source: string,
    directory: string,
  ): Promise<{ duration: number; files: { name: string; mediaType: string }[] }>;
}
export function startVideoProcessing(
  jobs: VideoJobs,
  storage: VideoStorages,
  encoder: VideoEncoder,
  report: (error: unknown) => void,
) {
  let stopped = false;
  let running = false;
  const process = async () => {
    if (stopped || running) {
      return;
    }
    running = true;
    let job: VideoJob | null = null;
    let directory: string | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const written: VideoAsset[] = [];
    let publishing = false;
    try {
      job = await jobs.claim();
      if (!job) {
        return;
      }
      const active = job;
      heartbeat = setInterval(() => {
        void jobs.heartbeat(active).catch(report);
      }, 20000);
      heartbeat.unref();
      directory = await mkdtemp(join(tmpdir(), 'edutube-video-'));
      const source = join(directory, 'source.mp4');
      const store = storage.get(job.storageDriver);
      await pipeline(await store.read(job.sourceKey), createWriteStream(source, { mode: 0o600 }));
      const result = await encoder.encode(source, directory);
      const assets = written;
      for (const file of result.files) {
        const path = join(directory, file.name);
        const size = (await stat(path)).size;
        const key = `videos/${job.id}/runs/${job.processingToken}/${file.name}`;
        await store.write(key, createReadStream(path), size, file.mediaType);
        assets.push({
          name: file.name,
          storageKey: key,
          mediaType: file.mediaType,
          sizeBytes: size,
        });
      }
      publishing = true;
      if (!(await jobs.finish(job, result.duration, assets))) {
        for (const asset of assets) {
          await store.remove(asset.storageKey).catch(report);
        }
      }
    } catch (error) {
      report(error);
      if (job && !publishing) {
        for (const asset of written) {
          await storage.get(job.storageDriver).remove(asset.storageKey).catch(report);
        }
      }
      if (job) {
        await jobs.fail(job).catch(report);
      }
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      try {
        if (directory) {
          await rm(directory, { recursive: true, force: true });
        }
      } finally {
        running = false;
      }
    }
  };
  const timer = setInterval(() => {
    void process().catch(report);
  }, 2000);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
}
