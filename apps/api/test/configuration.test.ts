import { expect, it } from 'vitest';
import { readConfiguration } from '../src/config/environment';
const database = { DATABASE_URL: 'postgresql://example.test/edutube' };

it('normalise l’origine et accepte les valeurs facultatives vides de Compose', () => {
  const config = readConfiguration({
    ...database,
    WEB_ORIGIN: 'https://example.test/',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    WEBDAV_URL: '',
  });
  expect(config.http.origin).toBe('https://example.test');
  expect(config.mail.user).toBeUndefined();
  expect(config.videos.webdav).toBeUndefined();
});
it('conserve les mots de passe PostgreSQL bruts lorsque les paramètres sont séparés', () => {
  const config = readConfiguration({
    PGHOST: 'postgres',
    PGPORT: '5432',
    PGUSER: 'edutube',
    PGDATABASE: 'edutube',
    PGPASSWORD: 'exemple@:#',
  });
  expect(config.database).toMatchObject({ host: 'postgres', password: 'exemple@:#', port: 5432 });
});
it.each([
  { API_PORT: '70000' },
  { SMTP_PORT: '0' },
  { WEB_ORIGIN: 'https://example.test/sous-dossier' },
  { WEB_ORIGIN: 'https://example.test?token=secret' },
  { WEB_ORIGIN: 'adresse invalide' },
  { DATABASE_URL: 'https://example.test' },
  { DATABASE_URL: 'invalide' },
  { LOG_LEVEL: 'inconnu' },
  { SHUTDOWN_TIMEOUT_MS: '0' },
])('refuse un réglage invalide sans divulguer son contenu : %j', (overrides) => {
  expect(() => readConfiguration({ ...database, ...overrides })).toThrow(/Configuration invalide/);
});
it('exige une connexion PostgreSQL explicite', () => {
  expect(() => readConfiguration({})).toThrow(/PostgreSQL incomplète/);
});
it('exige les accès du fournisseur actif et des identifiants SMTP cohérents', () => {
  expect(() => readConfiguration({ ...database, VIDEO_STORAGE: 'webdav' })).toThrow(
    /WebDAV incomplète/,
  );
  expect(() => readConfiguration({ ...database, SMTP_USER: 'compte' })).toThrow(/SMTP_USER/);
});
it('valide le stockage WebDAV et ne recopie pas les secrets dans les erreurs', () => {
  const source = {
    ...database,
    VIDEO_STORAGE: 'webdav',
    WEBDAV_URL: 'https://cloud.example/dossier',
    WEBDAV_TOKEN: 'exemple-prive',
  };
  expect(readConfiguration(source).videos.driver).toBe('webdav');
  try {
    readConfiguration({ ...source, DATABASE_URL: 'secret-invalide' });
    throw new Error('Le réglage aurait dû être refusé.');
  } catch (error) {
    expect(String(error)).toContain('DATABASE_URL');
    expect(String(error)).not.toContain('secret-invalide');
    expect(String(error)).not.toContain('exemple-prive');
  }
});
