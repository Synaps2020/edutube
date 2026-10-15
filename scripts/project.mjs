import { copyFileSync, existsSync, mkdirSync, constants } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../', import.meta.url));
process.chdir(directory);
const [action, command, ...argumentsList] = process.argv.slice(2);

if (action === 'config') {
  try {
    copyFileSync('.env.example', '.env', constants.COPYFILE_EXCL);
    console.log('Configuration créée dans .env.');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    console.log('Configuration .env conservée.');
  }
  mkdirSync('data/resources', { recursive: true, mode: 0o700 });
} else {
  if (existsSync('.env')) {
    loadEnvFile('.env');
  }
  const environment = {
    ...process.env,
    HOST: process.env.HOST ?? '127.0.0.1',
    PORT: process.env.PORT ?? '3082',
    API_PORT: process.env.API_PORT ?? '3083',
    DATABASE_URL:
      process.env.DATABASE_URL ??
      `postgresql://edutube:${encodeURIComponent(process.env.DB_PASSWORD ?? 'edutube-local')}@127.0.0.1:${process.env.DB_PORT ?? '5434'}/edutube`,
    WEB_ORIGIN: process.env.WEB_ORIGIN ?? `http://localhost:${process.env.PORT ?? '3082'}`,
    MINIO_ENDPOINT:
      process.env.MINIO_ENDPOINT ?? `http://127.0.0.1:${process.env.MINIO_PORT ?? '9040'}`,
  };
  environment.TEST_ORIGIN ??= environment.WEB_ORIGIN;
  if (action === 'doctor') {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 20 || (major === 20 && minor < 19) || (major === 22 && minor < 12)) {
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
    const child = spawn(command, argumentsList, { env: environment, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => child.kill(signal));
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
