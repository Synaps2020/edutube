import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEnvironment } from './environment.mjs';

test('les options vides utilisent les valeurs locales et normalisent l’origine', () => {
  const config = resolveEnvironment({
    PORT: '3100',
    API_PORT: '',
    WEB_ORIGIN: 'http://localhost:3100/',
  });
  assert.equal(config.API_PORT, '3083');
  assert.equal(config.WEB_ORIGIN, 'http://localhost:3100');
});
for (const input of [
  { PORT: '70000' },
  { API_PORT: 'abc' },
  { PORT: '3083' },
  { WEB_ORIGIN: 'https://example.test/chemin' },
  { WEB_ORIGIN: 'https://user:secret@example.test' },
]) {
  test('refuse un port ou une origine incohérente', () => {
    assert.throws(() => resolveEnvironment(input));
  });
}

test('une origine mal formée ne divulgue pas sa valeur dans le message', () => {
  assert.throws(
    () => resolveEnvironment({ WEB_ORIGIN: 'secret-invalide' }),
    (error) => {
      assert.match(error.message, /WEB_ORIGIN/);
      assert.doesNotMatch(error.message, /secret-invalide/);
      return true;
    },
  );
});

test('ne force pas le mode développement lors de la compilation de production', () => {
  assert.equal(resolveEnvironment({}).NODE_ENV, undefined);
  assert.equal(resolveEnvironment({ NODE_ENV: 'production' }).NODE_ENV, 'production');
});

test('les accès PostgreSQL séparés ne sont pas remplacés par une adresse locale', () => {
  const config = resolveEnvironment({ PGHOST: 'postgres', PGPASSWORD: 'exemple@:#' });
  assert.equal(config.DATABASE_URL, undefined);
  assert.equal(config.PGPASSWORD, 'exemple@:#');
});

test('le proxy et les scripts vidéo suivent le port et l’adresse du serveur', () => {
  const config = resolveEnvironment({ API_HOST: '0.0.0.0', API_PORT: '3183' });
  assert.equal(config.API_URL, 'http://127.0.0.1:3183/api/v1');
  assert.equal(resolveEnvironment({ API_HOST: '::1' }).API_URL, 'http://[::1]:3083/api/v1');
  assert.equal(
    resolveEnvironment({ API_URL: 'https://example.test/api/v1/' }).API_URL,
    'https://example.test/api/v1',
  );
  assert.throws(() => resolveEnvironment({ API_URL: 'https://compte:secret@example.test/api/v1' }));
});
