import { copyFileSync, mkdirSync, chmodSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnvironment, projectDirectory } from './environment.mjs';
import { startProcess, stopProcess } from './processes.mjs';

process.chdir(projectDirectory);
const [action, command, ...argumentsList] = process.argv.slice(2);

if (action === 'config') {
  try {
    copyFileSync('.env.example', '.env', constants.COPYFILE_EXCL);
    chmodSync('.env', 0o600);
    console.log('Configuration créée dans .env.');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    console.log('Configuration .env conservée.');
  }
  const environment = loadEnvironment();
  mkdirSync(environment.STORAGE_DIR ?? 'data/resources', { recursive: true, mode: 0o700 });
} else {
  const environment = loadEnvironment();
  if (action === 'doctor') {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (
      major < 20 ||
      major === 21 ||
      (major === 20 && minor < 19) ||
      (major === 22 && minor < 12)
    ) {
      throw new Error('Node.js 20.19+, 22.12+ ou une version ultérieure est nécessaire.');
    }
    console.log(`Node.js ${process.versions.node} : OK`);
    for (const [program, args] of [
      ['npm', ['--version']],
      ['docker', ['compose', 'version']],
      ['docker', ['info', '--format', '{{.ServerVersion}}']],
      ['docker', ['compose', 'config', '--quiet']],
    ]) {
      const result = spawnSync(program, args, { env: environment, encoding: 'utf8' });
      if (result.error || result.status !== 0) {
        console.error(
          `${program} ${args.join(' ')} : échec. Vérifiez son installation et le démarrage de Docker.`,
        );
        process.exit(1);
      }
      console.log(`${program} ${args.join(' ')} : OK`);
    }
  } else if (action === 'run' && command) {
    const child = startProcess(command, argumentsList, { env: environment });
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => stopProcess(child, signal));
    }
    child.on('error', (error) => {
      console.error(`Impossible de lancer ${command} : ${error.message}`);
      process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
      process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
    });
  } else {
    throw new Error('Utilisation : project.mjs config | doctor | run commande [arguments]');
  }
}
