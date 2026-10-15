import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function fixture(context) {
  const directory = mkdtempSync(join(tmpdir(), 'edutube-config-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'scripts'));
  const script = join(directory, 'scripts/project.mjs');
  copyFileSync(new URL('./project.mjs', import.meta.url), script);
  for (const name of ['environment.mjs', 'processes.mjs']) {
    copyFileSync(new URL(name, import.meta.url), join(directory, 'scripts', name));
  }
  const environment = { ...process.env };
  for (const name of [
    'DATABASE_URL',
    'DB_PORT',
    'DB_PASSWORD',
    'HOST',
    'PORT',
    'API_PORT',
    'API_HOST',
    'API_URL',
    'WEB_ORIGIN',
    'MINIO_ENDPOINT',
    'MINIO_PORT',
    'TEST_ORIGIN',
    'SMTP_FROM',
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
  ]) {
    delete environment[name];
  }
  return {
    directory,
    execute(args, overrides = {}) {
      const result = spawnSync(process.execPath, [script, ...args], {
        env: { ...environment, ...overrides },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    },
  };
}

test('la configuration est créée sans remplacer les réglages existants', (context) => {
  const project = fixture(context);
  const path = join(project.directory, '.env');
  writeFileSync(join(project.directory, '.env.example'), 'PORT=4200\n');
  project.execute(['config']);
  assert.equal(readFileSync(path, 'utf8'), 'PORT=4200\n');
  writeFileSync(path, 'PORT=4300\n');
  project.execute(['config']);
  assert.equal(readFileSync(path, 'utf8'), 'PORT=4300\n');
});

test('les commandes reçoivent les adresses et les valeurs complexes du fichier .env', (context) => {
  const project = fixture(context);
  writeFileSync(
    join(project.directory, '.env'),
    "PORT=4200\nDB_PORT=5440\nDB_PASSWORD='exemple@:#'\nSMTP_FROM=EduTube <test@example.test>\nMINIO_PORT=9050\n",
  );
  const output = project.execute([
    'run',
    process.execPath,
    '-p',
    'JSON.stringify({port:process.env.PORT, database:process.env.DATABASE_URL, origin:process.env.WEB_ORIGIN, storage:process.env.MINIO_ENDPOINT, sender:process.env.SMTP_FROM})',
  ]);
  assert.deepEqual(JSON.parse(output), {
    port: '4200',
    database: 'postgresql://edutube:exemple%40%3A%23@127.0.0.1:5440/edutube',
    origin: 'http://localhost:4200',
    storage: 'http://127.0.0.1:9050',
    sender: 'EduTube <test@example.test>',
  });
});

test('les options du terminal priment et une adresse de base explicite est conservée', (context) => {
  const project = fixture(context);
  writeFileSync(
    join(project.directory, '.env'),
    'PORT=4200\nDATABASE_URL=postgresql://example.test/base\n',
  );
  const output = project.execute(
    [
      'run',
      process.execPath,
      '-p',
      'JSON.stringify({port:process.env.PORT, database:process.env.DATABASE_URL, origin:process.env.WEB_ORIGIN})',
    ],
    { PORT: '4400' },
  );
  assert.deepEqual(JSON.parse(output), {
    port: '4400',
    database: 'postgresql://example.test/base',
    origin: 'http://localhost:4400',
  });
});
