import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export const projectDirectory = fileURLToPath(new URL('../', import.meta.url));

/** Le terminal garde la priorité ; les chemins partent toujours de la racine. */
export function loadEnvironment() {
  process.chdir(projectDirectory);
  if (existsSync('.env')) {
    loadEnvFile('.env');
  }
  return resolveEnvironment(process.env);
}

export function resolveEnvironment(source) {
  const values = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const environment = {
    ...values,
    HOST: values.HOST ?? '127.0.0.1',
    PORT: values.PORT ?? '3082',
    API_HOST: values.API_HOST ?? '127.0.0.1',
    API_PORT: values.API_PORT ?? '3083',
  };
  for (const name of [
    'PORT',
    'API_PORT',
    'DB_PORT',
    'MINIO_PORT',
    'MINIO_CONSOLE_PORT',
    'SMTP_PORT',
    'MAIL_UI_PORT',
  ]) {
    if (
      environment[name] !== undefined &&
      (!/^\d+$/.test(environment[name]) ||
        Number(environment[name]) < 1 ||
        Number(environment[name]) > 65535)
    ) {
      throw new Error(`${name} doit être un port entre 1 et 65535.`);
    }
  }
  if (environment.PORT === environment.API_PORT) {
    throw new Error('PORT et API_PORT doivent être différents.');
  }
  // Un mot de passe brut reste distinct de son écriture dans une URL.
  if (!environment.DATABASE_URL && !environment.PGHOST) {
    environment.DATABASE_URL = `postgresql://edutube:${encodeURIComponent(values.DB_PASSWORD ?? 'edutube-local')}@127.0.0.1:${values.DB_PORT ?? '5434'}/edutube`;
  }
  environment.WEB_ORIGIN ??= `http://localhost:${environment.PORT}`;
  if (!URL.canParse(environment.WEB_ORIGIN)) {
    throw new Error('WEB_ORIGIN doit être une origine HTTP ou HTTPS valide.');
  }
  const origin = new URL(environment.WEB_ORIGIN);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('WEB_ORIGIN doit contenir uniquement une origine HTTP ou HTTPS.');
  }
  environment.WEB_ORIGIN = origin.origin;
  environment.MINIO_ENDPOINT ??= `http://127.0.0.1:${values.MINIO_PORT ?? '9040'}`;
  const host = ['0.0.0.0', '::'].includes(environment.API_HOST)
    ? '127.0.0.1'
    : environment.API_HOST;
  const hostname = host.includes(':') ? `[${host}]` : host;
  environment.API_URL ??= `http://${hostname}:${environment.API_PORT}/api/v1`;
  if (!URL.canParse(environment.API_URL)) {
    throw new Error('API_URL doit être une adresse HTTP ou HTTPS valide.');
  }
  const apiAddress = new URL(environment.API_URL);
  if (
    !['http:', 'https:'].includes(apiAddress.protocol) ||
    apiAddress.username ||
    apiAddress.password ||
    apiAddress.search ||
    apiAddress.hash ||
    !['/api/v1', '/api/v1/'].includes(apiAddress.pathname)
  ) {
    throw new Error('API_URL doit désigner /api/v1, sans identifiants ni paramètres.');
  }
  environment.API_URL = `${apiAddress.origin}/api/v1`;
  environment.TEST_ORIGIN ??= environment.WEB_ORIGIN;
  return environment;
}
