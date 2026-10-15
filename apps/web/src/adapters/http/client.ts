import { z } from 'zod';
import { apiErrorSchema } from '@edutube/contracts';
export type TransportCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'HTTP_ERROR';
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
  idempotencyKey?: string;
  accept?: string;
}
export interface DownloadedResource {
  blob: Blob;
  fileName: string;
}
/** Créer ce client ne déclenche aucun appel ni changement dans la page. */
export class HttpClient {
  readonly baseUrl: string;
  constructor(
    baseUrl: string,
    private transport: typeof fetch = fetch,
    private timeoutMs = 10000,
    private csrfToken: () => string | undefined = () => undefined,
  ) {
    if (baseUrl.startsWith('/') && !baseUrl.startsWith('//')) {
      if (/[?#]/.test(baseUrl)) {
        throw new Error('Base API invalide.');
      }
    } else {
      const url = new URL(baseUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error('Base API invalide.');
      }
    }
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  private async send(
    path: string,
    options: RequestOptions,
    consume: (response: Response) => Promise<unknown>,
  ): Promise<unknown> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('Chemin API invalide.');
    }
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (options.signal?.aborted) {
      throw new DOMException('Requête annulée.', 'AbortError');
    }
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? this.timeoutMs);
    try {
      const response = await this.transport(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        signal: controller.signal,
        credentials: 'include',
        headers: {
          Accept: options.accept ?? 'application/json',
          ...(options.method && options.method !== 'GET' && this.csrfToken()
            ? { 'X-CSRF-Token': this.csrfToken()! }
            : {}),
          ...(options.body !== undefined && !options.formData
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
        },
        ...(options.formData
          ? { body: options.formData }
          : options.body !== undefined
            ? { body: JSON.stringify(options.body) }
            : {}),
      });
      if (!response.ok) {
        let json: unknown;
        try {
          json = await response.json();
        } catch {
          json = null;
        }
        const parsed = apiErrorSchema.safeParse(json);
        const retry = Number(response.headers.get('retry-after'));
        throw new HttpError(
          response.status,
          parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
          parsed.success ? parsed.data.error.message : `Requête refusée (${response.status}).`,
          parsed.success
            ? parsed.data.error.requestId
            : (response.headers.get('x-request-id') ?? undefined),
          Number.isFinite(retry) && retry > 0 ? retry : undefined,
        );
      }
      return await consume(response);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      if (options.signal?.aborted) {
        throw new DOMException('Requête annulée.', 'AbortError');
      }
      if (timedOut) {
        throw new HttpError(0, 'TIMEOUT', 'Le serveur met trop de temps à répondre.');
      }
      throw new HttpError(0, 'NETWORK_ERROR', 'Impossible de joindre le serveur.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  async request<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    options: RequestOptions = {},
  ): Promise<T> {
    return (await this.send(path, options, async (response) => {
      if (response.status === 204) {
        const parsed = schema.safeParse(undefined);
        if (!parsed.success) {
          throw new HttpError(204, 'INVALID_RESPONSE', 'Réponse vide inattendue.');
        }
        return parsed.data;
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new HttpError(response.status, 'INVALID_RESPONSE', 'Réponse JSON illisible.');
      }
      const parsed = z.object({ data: schema }).strict().safeParse(json);
      if (!parsed.success) {
        throw new HttpError(
          response.status,
          'INVALID_RESPONSE',
          'Réponse incompatible avec le contrat API.',
          response.headers.get('x-request-id') ?? undefined,
        );
      }
      return parsed.data.data;
    })) as T;
  }
  async download(
    path: string,
    fallbackName: string,
    signal?: AbortSignal,
  ): Promise<DownloadedResource> {
    return (await this.send(path, { signal, accept: '*/*', timeoutMs: 60000 }, async (response) => {
      const disposition = response.headers.get('content-disposition') ?? '';
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const plain = /filename="([^"]+)"/i.exec(disposition)?.[1];
      let candidate = plain ?? fallbackName;
      try {
        if (encoded) {
          candidate = decodeURIComponent(encoded);
        }
      } catch {
        candidate = fallbackName;
      }
      const fileName =
        candidate
          .split(/[\\/]/)
          .pop()
          ?.split('')
          .filter((character) => character.charCodeAt(0) >= 32)
          .join('') || 'resource';
      return { blob: await response.blob(), fileName };
    })) as DownloadedResource;
  }
}
