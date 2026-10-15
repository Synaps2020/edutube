import { Administration } from './application/administration';
import { PostgresAdministration } from './adapters/postgres/administration-repository';
import { configuredVideoStorages } from './adapters/storage/video-storages';
import { PostgresVideos } from './adapters/postgres/video-repository';
import { PostgresVideoJobs } from './adapters/postgres/video-jobs';
import { PostgresChapterAccess } from './adapters/postgres/chapter-access';
import { ChapterAccess } from './application/chapter-access';
import { Videos } from './application/videos';
import { startVideoProcessing } from './application/video-processing';
import { MediaEncoder } from './adapters/media-encoder';
import { Identity } from './application/identity';
import { PostgresIdentity } from './adapters/postgres/identity-repository';
import { mailDelivery } from './adapters/mail';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Resources } from './application/resources';
import { PostgresResources } from './adapters/postgres/resource-repository';
import { ResourceFiles } from './adapters/storage/resource-files';
import { Teaching } from './application/teaching';
import { PostgresTeaching } from './adapters/postgres/teaching-repository';
import { Pool } from 'pg';
import { z } from 'zod';
import { Learning } from './application/learning';
import { PostgresLearning } from './adapters/postgres/learning-repository';
import { Exercises } from './application/exercises';
import { PostgresQuizzes } from './adapters/postgres/quiz-repository';
import { Catalog } from './application/catalog';
import { Authentication } from './application/authentication';
import { PostgresCatalog } from './adapters/postgres/catalog-repository';
import { PostgresAccounts } from './adapters/postgres/account-repository';
import { passwords, tokens } from './adapters/security/credentials';
import { createServer } from './adapters/http/server';
const environment = z
  .object({
    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(1026),
    SMTP_FROM: z.string().default('EduTube <bonjour@edutube.example.test>'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_REQUIRE_TLS: z.enum(['true', 'false']).default('false'),
    STORAGE_DIR: z.string().min(1).default('data/resources'),
    DATABASE_URL: z.string().url(),
    WEB_ORIGIN: z.string().url().default('http://localhost:3082'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3083),
    API_HOST: z.string().default('127.0.0.1'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .parse(process.env);
const pool = new Pool({
  connectionString: environment.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
const catalogRepository = new PostgresCatalog(pool);
const projectDirectory = fileURLToPath(new URL('../../../', import.meta.url));
const storage = new ResourceFiles(resolve(projectDirectory, environment.STORAGE_DIR));
await storage.ready();
const identity = new Identity(
  new PostgresIdentity(pool),
  passwords,
  tokens,
  environment.WEB_ORIGIN,
);
const videoStorage = configuredVideoStorages();
await videoStorage.get().ready();
const chapterAccess = new ChapterAccess(new PostgresChapterAccess(pool));
const app = await createServer({
  administration: new Administration(new PostgresAdministration(pool), async () => {
    const token = tokens.create();
    return {
      passwordHash: await passwords.hash(tokens.create()),
      tokenHash: tokens.digest(token),
      link: `${environment.WEB_ORIGIN}/nouveau-mot-de-passe#token=${token}`,
    };
  }),
  chapterAccess,
  videos: new Videos(new PostgresVideos(pool), videoStorage, chapterAccess),
  identity,
  resources: new Resources(new PostgresResources(pool), storage),
  teaching: new Teaching(new PostgresTeaching(pool)),
  learning: new Learning(new PostgresLearning(pool), catalogRepository),
  exercises: new Exercises(new PostgresQuizzes(pool)),
  catalog: new Catalog(catalogRepository),
  authentication: new Authentication(
    new PostgresAccounts(pool),
    passwords,
    tokens,
    undefined,
    undefined,
    () => identity.welcome(),
  ),
  origin: new URL(environment.WEB_ORIGIN).origin,
  secureCookie: new URL(environment.WEB_ORIGIN).protocol === 'https:',
  ready: async () => {
    await pool.query('SELECT 1 FROM enrollments LIMIT 1');
  },
  logger: true,
});
const stopMail = mailDelivery(
  pool,
  {
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    from: environment.SMTP_FROM,
    user: environment.SMTP_USER,
    password: environment.SMTP_PASSWORD,
    requireTLS: environment.SMTP_REQUIRE_TLS === 'true',
  },
  (error) => app.log.error({ err: error }, 'Envoi du message différé'),
);
const stopVideos = startVideoProcessing(
  new PostgresVideoJobs(pool),
  videoStorage,
  new MediaEncoder(),
  (error) => app.log.error({ err: error }, 'Préparation vidéo interrompue'),
);
app.addHook('onClose', async () => {
  await stopVideos();
  await stopMail();
  await pool.end();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
