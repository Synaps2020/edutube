import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthError } from './auth';
import { env } from './env';

// ---------------------------------------------------------------------------
// Réponses JSON normalisées
// Format : { data } en succès, { error: { code, message, details? } } en erreur.
// ---------------------------------------------------------------------------
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = 'ERREUR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (m: string, d?: unknown) => new ApiError(400, m, 'REQUETE_INVALIDE', d);
export const notFound = (m = 'Ressource introuvable.') => new ApiError(404, m, 'INTROUVABLE');
export const forbidden = (m = 'Accès refusé.') => new ApiError(403, m, 'INTERDIT');
export const conflict = (m: string) => new ApiError(409, m, 'CONFLIT');

// Convertit les BigInt Prisma (tailles de fichiers) pour la sérialisation JSON.
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)),
  );
}

// ---------------------------------------------------------------------------
// Protection CSRF : toute requête mutative doit porter l'en-tête X-Requested-With.
// Le cookie de session étant SameSite=Lax, un site tiers ne peut ni lire le cookie ni
// poser un en-tête personnalisé via un formulaire HTML classique.
// ---------------------------------------------------------------------------
function checkCsrf(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  const hdr = req.headers.get('x-requested-with');
  if (hdr !== 'EduTube') {
    throw new ApiError(403, 'Requête rejetée (protection CSRF) : en-tête X-Requested-With manquant.', 'CSRF');
  }
  // Vérification d'origine supplémentaire quand le navigateur l'envoie.
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const o = new URL(origin);
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
      if (o.host !== host) {
        throw new ApiError(403, 'Origine de la requête non autorisée.', 'CSRF');
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
  }
}

// ---------------------------------------------------------------------------
// Rate limiting applicatif (mémoire locale, par processus). Nginx applique en plus une limite
// réseau ; celle-ci protège les routes sensibles (connexion, inscription, commentaires).
// ---------------------------------------------------------------------------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = env.rateLimitMax, windowSec = env.rateLimitWindowSec) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return;
  }
  b.count += 1;
  if (b.count > max) {
    throw new ApiError(429, 'Trop de requêtes. Merci de réessayer dans quelques instants.', 'TROP_DE_REQUETES');
  }
  if (buckets.size > 50_000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
}

export function ipOf(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '0.0.0.0').trim();
}

// ---------------------------------------------------------------------------
// Enveloppe de gestion d'erreurs pour les Route Handlers
// ---------------------------------------------------------------------------
type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<Response>;

export function handler<Ctx = { params: Record<string, string> }>(fn: Handler<Ctx>, opts?: { csrf?: boolean }) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      if (opts?.csrf !== false) checkCsrf(req);
      return await fn(req, ctx);
    } catch (e) {
      // Laisser passer les signaux internes de Next.js (rendu dynamique, redirections)
      if (e && typeof e === 'object' && 'digest' in e && typeof (e as { digest?: string }).digest === 'string') throw e;
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  if (e instanceof AuthError) {
    return NextResponse.json({ error: { code: e.status === 401 ? 'NON_AUTHENTIFIE' : 'INTERDIT', message: e.message } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Données invalides.', details: e.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return NextResponse.json({ error: { code: 'CONFLIT', message: 'Cette valeur existe déjà.' } }, { status: 409 });
    if (e.code === 'P2025') return NextResponse.json({ error: { code: 'INTROUVABLE', message: 'Ressource introuvable.' } }, { status: 404 });
  }
  console.error('[api] erreur non gérée', e);
  return NextResponse.json({ error: { code: 'ERREUR_SERVEUR', message: 'Une erreur interne est survenue.' } }, { status: 500 });
}

export async function parseJson<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Corps JSON invalide.');
  }
  return schema.parse(body);
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (obj[k] === undefined) obj[k] = v;
    else obj[k] = ([] as string[]).concat(obj[k], v);
  });
  return schema.parse(obj);
}

export function paginationMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
