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
import type { VideoStorages } from './application/video-storage';
import { StartupError, type Configuration } from './config/environment';
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
export async function createApplication(configuration: Configuration) {
  const pool = new Pool(configuration.database);
  let videoStorage: VideoStorages | undefined;
  let application: Awaited<ReturnType<typeof createServer>> | undefined;
  pool.on('error', () => {
    application?.log.error('Une connexion PostgreSQL inactive a été interrompue');
  });
  let stopMail = async () => {};
  let stopVideos = async () => {};
  try {
    // Échouer avant l’écoute si la base n’a pas reçu les migrations requises.
    try {
      await pool.query('SELECT 1 FROM administration_audit LIMIT 1');
    } catch {
      throw new StartupError(
        'PostgreSQL indisponible ou incomplet. Vérifiez ses accès et lancez make migrate.',
      );
    }
    const catalogRepository = new PostgresCatalog(pool);
    const projectDirectory = fileURLToPath(new URL('../../../', import.meta.url));
    const storage = new ResourceFiles(resolve(projectDirectory, configuration.resources));
    try {
      await storage.ready();
    } catch {
      throw new StartupError(
        'Dossier des documents inaccessible. Vérifiez STORAGE_DIR et ses droits.',
      );
    }
    const identity = new Identity(
      new PostgresIdentity(pool),
      passwords,
      tokens,
      configuration.http.origin,
    );
    videoStorage = configuredVideoStorages(configuration.videos);
    const storages = videoStorage;
    try {
      await videoStorage.get().ready();
    } catch {
      throw new StartupError(
        'Stockage vidéo indisponible. Vérifiez VIDEO_STORAGE et les accès du fournisseur.',
      );
    }
    const chapterAccess = new ChapterAccess(new PostgresChapterAccess(pool));
    const app = await createServer({
      administration: new Administration(new PostgresAdministration(pool), async () => {
        const token = tokens.create();
        return {
          passwordHash: await passwords.hash(tokens.create()),
          tokenHash: tokens.digest(token),
          link: `${configuration.http.origin}/nouveau-mot-de-passe#token=${token}`,
        };
      }),
      chapterAccess,
      videos: new Videos(new PostgresVideos(pool), storages, chapterAccess),
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
      origin: new URL(configuration.http.origin).origin,
      secureCookie: new URL(configuration.http.origin).protocol === 'https:',
      ready: async () => {
        await pool.query('SELECT 1 FROM enrollments LIMIT 1');
      },
      logger: {
        level: configuration.logLevel,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      },
    });
    application = app;
    app.addHook('onClose', async () => {
      // Les traitements doivent libérer la base avant sa fermeture.
      try {
        await Promise.all([stopVideos(), stopMail()]);
      } finally {
        storages.close();
        await pool.end();
      }
    });
    app.addHook('onListen', async () => {
      stopMail = mailDelivery(pool, configuration.mail, (error) =>
        app.log.error({ err: error }, 'Envoi du message différé'),
      );
      stopVideos = startVideoProcessing(
        new PostgresVideoJobs(pool),
        storages,
        new MediaEncoder(configuration.media.encoder, configuration.media.probe),
        (error) => app.log.error({ err: error }, 'Préparation vidéo interrompue'),
      );
    });
    return app;
  } catch (error) {
    if (application) {
      await application.close();
    } else {
      videoStorage?.close();
      await pool.end();
    }
    throw error;
  }
}
