import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import probe from '@ffprobe-installer/ffprobe';
import { z } from 'zod';
import type { VideoEncoder } from '../application/video-processing';
const run = promisify(execFile);
export class MediaEncoder implements VideoEncoder {
  constructor(
    private encoderPath = ffmpeg ?? 'ffmpeg',
    private probePath = probe.path,
  ) {}
  async encode(source: string, directory: string) {
    const inspected = await run(
      this.probePath,
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        'mov',
        '-show_entries',
        'format=duration:stream=codec_type,height',
        '-of',
        'json',
        source,
      ],
      { timeout: 30000, maxBuffer: 1048576 },
    );
    const data = z
      .object({
        format: z.object({ duration: z.coerce.number().positive().max(7200) }),
        streams: z.array(z.object({ codec_type: z.string(), height: z.number().optional() })),
      })
      .parse(JSON.parse(inspected.stdout));
    const height = data.streams.find((stream) => stream.codec_type === 'video')?.height;
    if (!height || height > 4320) {
      throw new Error('Format vidéo non pris en charge.');
    }
    const high = Math.max(2, Math.floor(Math.min(720, height) / 2) * 2);
    const low = Math.max(2, Math.floor(Math.min(360, height / 2) / 2) * 2);
    const audio = data.streams.some((stream) => stream.codec_type === 'audio');
    await run(
      this.encoderPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        'mov',
        '-i',
        source,
        ...(audio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']),
        '-filter_complex',
        `[0:v]split=2[first][second];[first]scale=-2:${high}[high];[second]scale=-2:${low}[low]`,
        '-map',
        '[high]',
        '-map',
        audio ? '0:a:0' : '1:a:0',
        '-map',
        '[low]',
        '-map',
        audio ? '0:a:0' : '1:a:0',
        '-t',
        String(data.format.duration),
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-threads',
        '2',
        '-r',
        '25',
        '-g',
        '150',
        '-keyint_min',
        '150',
        '-sc_threshold',
        '0',
        '-b:v:0',
        '1800k',
        '-b:v:1',
        '500k',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-ac',
        '2',
        '-f',
        'hls',
        '-hls_time',
        '6',
        '-hls_playlist_type',
        'vod',
        '-hls_segment_filename',
        join(directory, '%v-%05d.ts'),
        '-master_pl_name',
        'master.m3u8',
        '-var_stream_map',
        'v:0,a:0 v:1,a:1',
        join(directory, '%v.m3u8'),
      ],
      { timeout: 600000, maxBuffer: 1048576 },
    );
    await run(
      this.encoderPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        'mov',
        '-i',
        source,
        '-frames:v',
        '1',
        '-vf',
        'scale=640:-2',
        join(directory, 'poster.jpg'),
      ],
      { timeout: 30000, maxBuffer: 1048576 },
    );
    return {
      duration: data.format.duration,
      files: (await readdir(directory))
        .filter((name) => /^(master|[01])\.m3u8$|^[01]-\d{5}\.ts$|^poster\.jpg$/.test(name))
        .map((name) => ({
          name,
          mediaType: name.endsWith('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : name.endsWith('.ts')
              ? 'video/mp2t'
              : 'image/jpeg',
        })),
    };
  }
}
