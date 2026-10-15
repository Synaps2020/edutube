import { HttpClient } from './client';
import { createApiServices } from './services';
let csrfToken: string | undefined;
const sessionListeners = new Set<() => void>();
export function onSessionLost(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}
export function setCsrfToken(token?: string) {
  csrfToken = token;
}
const transport: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401 && csrfToken) {
    csrfToken = undefined;
    for (const listener of sessionListeners) {
      listener();
    }
  }
  return response;
};
export const api = createApiServices({ baseUrl: '/api/v1', transport, csrfToken: () => csrfToken });

export const httpClient = new HttpClient('/api/v1', transport, 10000, () => csrfToken);
