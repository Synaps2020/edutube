import 'server-only';
import Busboy from 'busboy';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import type { NextRequest } from 'next/server';
import { abs, ensureDir, safeFileName } from './storage';
import { ApiError } from './api';
import { randomSuffix } from './utils';

// Analyse d'un corps multipart EN FLUX (busboy) : les fichiers sont écrits directement sur le
// disque au lieu d'être chargés en mémoire — indispensable pour des vidéos de plusieurs Go.
// Les fichiers sont déposés dans `tmp/<suffix>/` puis déplacés par l'appelant vers leur
// emplacement définitif (originals/<mediaId>/…).

export interface UploadedFile {
  field: string;
  rel: string; // chemin relatif à MEDIA_ROOT
  name: string;
  mime: string;
  size: number;
}

export interface MultipartResult {
  fields: Record<string, string | string[]>;
  files: UploadedFile[];
}

export async function parseMultipart(req: NextRequest, opts: { maxFileBytes: number; allowedFields?: string[] }): Promise<MultipartResult> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) throw new ApiError(400, 'Le corps de la requête doit être de type multipart/form-data.', 'REQUETE_INVALIDE');
  if (!req.body) throw new ApiError(400, 'Corps de requête vide.', 'REQUETE_INVALIDE');

  const tmpDir = path.join('tmp', randomSuffix(12));
  await ensureDir(tmpDir);

  const fields: Record<string, string | string[]> = {};
  const files: UploadedFile[] = [];
  const writes: Promise<void>[] = [];

  await new Promise<void>((resolve, reject) => {
    const bb = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: opts.maxFileBytes, files: 5, fields: 60, fieldSize: 1024 * 1024 },
    });
    let aborted = false;
    const fail = (e: Error) => {
      if (aborted) return;
      aborted = true;
      reject(e);
    };
    bb.on('field', (name, val) => {
      if (fields[name] === undefined) fields[name] = val;
      else fields[name] = ([] as string[]).concat(fields[name], val);
    });
    bb.on('file', (field, stream, info) => {
      if (opts.allowedFields && !opts.allowedFields.includes(field)) {
        stream.resume();
        return;
      }
      const name = safeFileName(info.filename || `${field}_${randomSuffix()}`);
      const rel = path.join(tmpDir, `${field}__${name}`);
      const ws = fs.createWriteStream(abs(rel));
      let size = 0;
      let truncated = false;
      stream.on('data', (d: Buffer) => { size += d.length; });
      stream.on('limit', () => { truncated = true; });
      const done = new Promise<void>((res, rej) => {
        ws.on('finish', () => {
          if (truncated) {
            fsp.rm(abs(rel), { force: true }).finally(() => rej(new ApiError(413, `Fichier trop volumineux (limite : ${Math.round(opts.maxFileBytes / 1024 / 1024)} Mo).`, 'FICHIER_TROP_VOLUMINEUX')));
            return;
          }
          files.push({ field, rel, name, mime: info.mimeType, size });
          res();
        });
        ws.on('error', rej);
      });
      writes.push(done);
      stream.pipe(ws);
    });
    bb.on('error', (e) => fail(e as Error));
    bb.on('close', () => resolve());
    Readable.fromWeb(req.body as unknown as import('stream/web').ReadableStream).pipe(bb);
  });

  try {
    await Promise.all(writes);
  } catch (e) {
    await fsp.rm(abs(tmpDir), { recursive: true, force: true });
    throw e;
  }
  return { fields, files };
}

// Déplace un fichier temporaire vers son emplacement définitif.
export async function moveUploaded(file: UploadedFile, destDir: string, finalName?: string): Promise<string> {
  await ensureDir(destDir);
  const destRel = path.join(destDir, safeFileName(finalName ?? file.name));
  await fsp.rename(abs(file.rel), abs(destRel)).catch(async () => {
    await fsp.copyFile(abs(file.rel), abs(destRel));
    await fsp.rm(abs(file.rel), { force: true });
  });
  // Nettoyage du dossier temporaire s'il est vide
  const tmpDir = path.dirname(file.rel);
  await fsp.rm(abs(tmpDir), { recursive: true, force: true }).catch(() => {});
  return destRel;
}

export async function discardUploads(files: UploadedFile[]) {
  for (const f of files) await fsp.rm(abs(path.dirname(f.rel)), { recursive: true, force: true }).catch(() => {});
}

// Convertit les champs multipart (chaînes) en objet exploitable par zod.
export function fieldsToObject(fields: Record<string, string | string[]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'keywords' && typeof v === 'string') out[k] = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (v === 'true' || v === 'on') out[k] = true;
    else if (v === 'false') out[k] = false;
    else out[k] = v;
  }
  return out;
}
