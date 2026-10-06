'use client';

// Client HTTP minimal pour l'API REST. Ajoute l'en-tête anti-CSRF et normalise les erreurs.
export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;
  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown, opts?: { formData?: FormData; signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'EduTube', Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (opts?.formData) payload = opts.formData;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: 'same-origin', signal: opts?.signal });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiClientError(res.status, e.code ?? 'ERREUR', e.message ?? `Erreur ${res.status}`, e.details);
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => request<T>('POST', path, undefined, { formData }),
};

// Téléversement avec progression (XMLHttpRequest — fetch ne fournit pas la progression d'envoi).
export function uploadWithProgress<T>(path: string, formData: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    xhr.setRequestHeader('X-Requested-With', 'EduTube');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let json: { data?: T; error?: { code: string; message: string; details?: Record<string, string[]> } } = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json.data as T);
      else reject(new ApiClientError(xhr.status, json.error?.code ?? 'ERREUR', json.error?.message ?? `Erreur ${xhr.status}`, json.error?.details));
    };
    xhr.onerror = () => reject(new ApiClientError(0, 'RESEAU', 'Connexion interrompue. Vérifiez votre réseau et réessayez.'));
    xhr.send(formData);
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.details) {
      const first = Object.entries(e.details)[0];
      if (first) return `${e.message} ${first[1][0]}`;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Une erreur est survenue.';
}
