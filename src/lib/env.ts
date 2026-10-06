// Lecture centralisée des variables d'environnement (voir .env.example).
// Les valeurs par défaut permettent un démarrage en développement ; en production,
// docker-compose impose les variables critiques (secret JWT, mot de passe base…).

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  appName: process.env.APP_NAME ?? 'EduTube',
  appUrl: process.env.APP_URL ?? 'http://localhost:8081',
  // Secret de signature des jetons de session (>= 32 caractères en production).
  jwtSecret: req('JWT_SECRET', 'dev-secret-a-changer-absolument-en-production-0123456789'),
  sessionTtlHours: int('SESSION_TTL_HOURS', 24 * 7),
  cookieName: process.env.SESSION_COOKIE_NAME ?? 'edu_session',
  cookieSecure: (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  // SSO OIDC optionnel : renseigner l'émetteur et les identifiants du fournisseur.
  ssoEnabled: (process.env.SSO_ENABLED ?? 'false') === 'true',
  ssoIssuer: process.env.SSO_ISSUER ?? '',
  ssoClientId: process.env.SSO_CLIENT_ID ?? '',
  ssoClientSecret: process.env.SSO_CLIENT_SECRET ?? '',
  ssoRedirectUri: process.env.SSO_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:8081'}/api/v1/auth/sso/callback`,
  ssoScopes: process.env.SSO_SCOPES ?? 'openid profile email',
  ssoAutoProvision: (process.env.SSO_AUTO_PROVISION ?? 'true') === 'true',
  ssoAdminEmails: (process.env.SSO_ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  // Stockage
  mediaRoot: process.env.MEDIA_ROOT ?? './data/media',
  mediaPublicBase: process.env.MEDIA_PUBLIC_BASE ?? '/media',
  maxUploadMb: int('MAX_UPLOAD_MB', 2048),
  maxSubmissionMb: int('MAX_SUBMISSION_MB', 500),
  // Inscriptions
  allowSelfRegistration: (process.env.ALLOW_SELF_REGISTRATION ?? 'true') === 'true',
  // Limitation de débit applicative (par IP, par fenêtre)
  rateLimitWindowSec: int('RATE_LIMIT_WINDOW_SEC', 60),
  rateLimitMax: int('RATE_LIMIT_MAX', 120),
  rateLimitAuthMax: int('RATE_LIMIT_AUTH_MAX', 10),
  // SMTP (optionnel : si absent, les e-mails sont journalisés au lieu d'être envoyés)
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: int('SMTP_PORT', 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'no-reply@education.sn',
  // Métriques Prometheus protégées par un jeton simple
  metricsToken: process.env.METRICS_TOKEN ?? '',
};
