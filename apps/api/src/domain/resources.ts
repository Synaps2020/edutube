import { DomainError } from './errors';
export interface Resource {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  fileName: string;
  mediaType: 'application/pdf' | 'text/plain';
  sizeBytes: number;
}
export interface StoredResource extends Resource {
  storageKey: string;
}
export interface ChapterAccess {
  courseId: string;
  lessonId: string;
  ownerId: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  revision: number;
  previewAllowed: boolean;
}
function hasControls(text: string, allowed: number[] = []) {
  for (const character of text) {
    const code = character.charCodeAt(0);
    if ((code < 32 || code === 127) && !allowed.includes(code)) {
      return true;
    }
  }
  return false;
}
export const maximumResourceSize = 10 * 1024 * 1024;
export function validateDocument(fileName: string, bytes: Uint8Array): Resource['mediaType'] {
  if (
    !fileName.trim() ||
    fileName.length > 200 ||
    /[<>:"/\\|?*]/.test(fileName) ||
    hasControls(fileName)
  ) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Choisissez un nom de fichier simple, sans caractères spéciaux.',
    );
  }
  if (!bytes.length) {
    throw new DomainError('VALIDATION_ERROR', 'Le document est vide.');
  }
  if (bytes.length > maximumResourceSize) {
    throw new DomainError('TOO_LARGE', 'Le document dépasse la limite de 10 Mo.');
  }
  if (/\.pdf$/i.test(fileName)) {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
      throw new DomainError('VALIDATION_ERROR', 'Ce fichier ne correspond pas à un document PDF.');
    }
    return 'application/pdf';
  }
  if (/\.txt$/i.test(fileName)) {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new DomainError('VALIDATION_ERROR', 'Le texte doit être enregistré au format UTF-8.');
    }
    if (hasControls(text, [9, 10, 13])) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'Ce fichier contient des données qui ne sont pas du texte.',
      );
    }
    return 'text/plain';
  }
  throw new DomainError('VALIDATION_ERROR', 'Seuls les documents PDF et TXT sont acceptés.');
}
export function allowResourceAccess(chapter: ChapterAccess, authenticated: boolean) {
  if (chapter.status !== 'PUBLISHED') {
    throw new DomainError('NOT_FOUND', 'Ce document est introuvable.');
  }
  if (!chapter.previewAllowed && !authenticated) {
    throw new DomainError('UNAUTHENTICATED', 'Connectez-vous pour télécharger ce document.');
  }
}
