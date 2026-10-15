import { fileURLToPath } from 'node:url';
import { loadEnvironment, resolveEnvironment } from './environment.mjs';
import { startProcess, stopProcess } from './processes.mjs';

const loaded = loadEnvironment();
const overrides = {};
const argumentsList = process.argv.slice(2);
for (let index = 0; index < argumentsList.length; index++) {
  const option = argumentsList[index];
  if (option === '--strictPort') {
    continue;
  }
  if (!['--host', '--port'].includes(option) || !argumentsList[index + 1]) {
    throw new Error('Options acceptées : --host adresse et --port nombre.');
  }
  overrides[option === '--host' ? 'HOST' : 'PORT'] = argumentsList[++index];
}
// Une option de port déplace aussi l’origine calculée, sauf réglage explicite.
if (overrides.PORT && !process.env.WEB_ORIGIN) {
  delete loaded.WEB_ORIGIN;
  delete loaded.TEST_ORIGIN;
}
const environment = resolveEnvironment({ ...loaded, ...overrides });
const children = [
  startProcess(process.execPath, ['--import', 'tsx', '--watch', 'apps/api/src/main.ts'], {
    env: environment,
  }),
  startProcess(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
      '--host',
      environment.HOST,
      '--port',
      environment.PORT,
      '--strictPort',
    ],
    { cwd: new URL('../apps/web', import.meta.url), env: environment },
  ),
];
let closing = false;
function stop(code = 0) {
  if (closing) {
    return;
  }
  closing = true;
  process.exitCode = code;
  for (const child of children) {
    stopProcess(child);
  }
  // Un processus bloqué ne doit pas laisser un port occupé après la fermeture.
  const deadline = setTimeout(() => {
    for (const child of children) {
      stopProcess(child, 'SIGKILL');
    }
  }, 10000);
  deadline.unref();
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(`Démarrage impossible : ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 1));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
