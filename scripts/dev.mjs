import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
if (existsSync('.env')) {
  loadEnvFile('.env');
}
const argumentsList = process.argv.slice(2);
const portIndex = argumentsList.indexOf('--port');
const port = portIndex >= 0 ? argumentsList[portIndex + 1] : (process.env.PORT ?? '3082');
const environment = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    `postgresql://edutube:${encodeURIComponent(process.env.DB_PASSWORD ?? 'edutube-local')}@127.0.0.1:${process.env.DB_PORT ?? '5434'}/edutube`,
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? `http://localhost:${port}`,
};
const children = [
  spawn(process.execPath, ['--import', 'tsx', '--watch', 'apps/api/src/main.ts'], {
    stdio: 'inherit',
    env: environment,
  }),
  spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
      '--host',
      process.env.HOST ?? '127.0.0.1',
      '--port',
      port,
      '--strictPort',
      ...argumentsList,
    ],
    { cwd: new URL('../apps/web', import.meta.url), stdio: 'inherit', env: environment },
  ),
];
let closing = false;
function stop(code = 0) {
  if (closing) {
    return;
  }
  closing = true;
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
