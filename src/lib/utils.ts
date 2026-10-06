import { randomBytes } from 'crypto';

// Génère un slug ASCII à partir d'un titre (accents supprimés).
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'contenu';
}

// Code court pour le partage (alphabet sans caractères ambigus : pas de 0/O/1/I/l).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function shortCode(len = 7): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function randomSuffix(len = 6): string {
  return randomBytes(len).toString('hex').slice(0, len);
}

export function formatDuration(sec?: number | null): string {
  if (!sec && sec !== 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

export function formatDate(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('fr-SN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-SN').format(n);
}

export function formatBytes(b?: number | bigint | null): string {
  if (b === null || b === undefined) return '';
  const n = Number(b);
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
  return `${(n / 1024 ** 3).toFixed(2)} Go`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export const REGIONS_SENEGAL = [
  'Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga',
  'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Thiès', 'Ziguinchor',
];

export const LANGUAGE_LABELS: Record<string, string> = { FR: 'Français', WO: 'Wolof', AR: 'Arabe', EN: 'Anglais' };
export const DIFFICULTY_LABELS: Record<string, string> = {
  DECOUVERTE: 'Découverte',
  INTERMEDIAIRE: 'Intermédiaire',
  APPROFONDISSEMENT: 'Approfondissement',
};
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente de validation',
  PROCESSING: 'Traitement en cours',
  PUBLISHED: 'Publié',
  REJECTED: 'Rejeté',
  ARCHIVED: 'Archivé',
  FAILED: 'Échec de traitement',
  APPROVED: 'Approuvée',
};
export const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrateur', TEACHER: 'Enseignant', STUDENT: 'Élève' };
export const LICENSES = ['CC BY-NC-SA 4.0', 'CC BY-SA 4.0', 'CC BY 4.0', 'CC BY-NC 4.0', 'Tous droits réservés — MEN'];
