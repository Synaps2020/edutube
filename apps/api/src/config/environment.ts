import { z } from 'zod';

// Seuls ces messages contrôlés peuvent être affichés au démarrage.
export class StartupError extends Error {}

const port = z.coerce.number().int().min(1).max(65535);
const address = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) {
      return false;
    }
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  }, 'Une adresse HTTP ou HTTPS sans identifiants est attendue.');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      'Une connexion PostgreSQL est attendue.',
    )
    .optional(),
  PGHOST: z.string().min(1).optional(),
  PGPORT: port.optional(),
  PGDATABASE: z.string().min(1).optional(),
  PGUSER: z.string().min(1).optional(),
  PGPASSWORD: z.string().min(1).optional(),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(5000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(10000),
  WEB_ORIGIN: address.default('http://localhost:3082').refine((value) => {
    if (!URL.canParse(value)) {
      return false;
    }
    const parsed = new URL(value);
    return parsed.pathname === '/' && !parsed.search && !parsed.hash;
  }, 'L’origine ne doit contenir ni chemin, ni paramètres.'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: port.default(3083),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  STORAGE_DIR: z.string().min(1).default('data/resources'),
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: port.default(1026),
  SMTP_FROM: z.string().min(1).default('EduTube <bonjour@edutube.example.test>'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_REQUIRE_TLS: z.enum(['true', 'false']).default('false'),
  VIDEO_STORAGE: z.enum(['minio', 'webdav']).default('minio'),
  MINIO_ENDPOINT: address.default('http://127.0.0.1:9040'),
  MINIO_ACCESS_KEY: z.string().min(1).default('edutube-local'),
  MINIO_SECRET_KEY: z.string().min(8).default('edutube-local-secret'),
  MINIO_BUCKET: z.string().min(3).default('edutube-videos'),
  MINIO_REGION: z.string().min(1).default('us-east-1'),
  WEBDAV_URL: address.optional(),
  WEBDAV_TOKEN: z.string().optional(),
  WEBDAV_USER: z.string().optional(),
  WEBDAV_PASSWORD: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
});

/** Les erreurs nomment les paramètres, sans recopier leurs valeurs ni les secrets. */
export function readConfiguration(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(
    Object.fromEntries(Object.entries(source).filter(([, value]) => value !== '')),
  );
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new StartupError(`Configuration invalide : ${names.join(', ')}. Consultez .env.example.`);
  }
  const values = result.data;
  if (
    !values.DATABASE_URL &&
    (!values.PGHOST || !values.PGDATABASE || !values.PGUSER || !values.PGPASSWORD)
  ) {
    throw new StartupError(
      'Configuration PostgreSQL incomplète : utilisez DATABASE_URL ou PGHOST, PGDATABASE, PGUSER et PGPASSWORD.',
    );
  }
  const webdavConfigured = !!values.WEBDAV_URL;
  if (
    (values.VIDEO_STORAGE === 'webdav' && !webdavConfigured) ||
    (webdavConfigured && !values.WEBDAV_TOKEN && (!values.WEBDAV_USER || !values.WEBDAV_PASSWORD))
  ) {
    throw new StartupError(
      'Configuration WebDAV incomplète : renseignez son adresse et ses accès.',
    );
  }
  if (!!values.SMTP_USER !== !!values.SMTP_PASSWORD) {
    throw new StartupError('SMTP_USER et SMTP_PASSWORD doivent être renseignés ensemble.');
  }
  return {
    mode: values.NODE_ENV,
    database: {
      ...(values.DATABASE_URL
        ? { connectionString: values.DATABASE_URL }
        : {
            host: values.PGHOST,
            port: values.PGPORT ?? 5432,
            database: values.PGDATABASE,
            user: values.PGUSER,
            password: values.PGPASSWORD,
          }),
      max: values.DB_POOL_SIZE,
      connectionTimeoutMillis: values.DB_CONNECT_TIMEOUT_MS,
      statement_timeout: values.DB_QUERY_TIMEOUT_MS,
    },
    http: {
      host: values.API_HOST,
      port: values.API_PORT,
      origin: new URL(values.WEB_ORIGIN).origin,
    },
    logLevel: values.LOG_LEVEL,
    shutdownTimeout: values.SHUTDOWN_TIMEOUT_MS,
    resources: values.STORAGE_DIR,
    mail: {
      host: values.SMTP_HOST,
      port: values.SMTP_PORT,
      from: values.SMTP_FROM,
      user: values.SMTP_USER,
      password: values.SMTP_PASSWORD,
      requireTLS: values.SMTP_REQUIRE_TLS === 'true',
    },
    videos: {
      driver: values.VIDEO_STORAGE,
      minio: {
        endpoint: values.MINIO_ENDPOINT,
        accessKey: values.MINIO_ACCESS_KEY,
        secretKey: values.MINIO_SECRET_KEY,
        region: values.MINIO_REGION,
        bucket: values.MINIO_BUCKET,
      },
      webdav: webdavConfigured
        ? {
            url: values.WEBDAV_URL!,
            token: values.WEBDAV_TOKEN,
            user: values.WEBDAV_USER,
            password: values.WEBDAV_PASSWORD,
          }
        : undefined,
    },
    media: { encoder: values.FFMPEG_PATH, probe: values.FFPROBE_PATH },
  };
}
export type Configuration = ReturnType<typeof readConfiguration>;
