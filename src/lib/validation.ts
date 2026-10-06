import { z } from 'zod';

// Schémas de validation partagés entre l'API et les formulaires.
// Messages en français (exigence éditoriale).

export const emailSchema = z.string().trim().toLowerCase().email('Adresse e-mail invalide.');
export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128, 'Mot de passe trop long.');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'Prénom requis.').max(60),
  lastName: z.string().trim().min(1, 'Nom requis.').max(60),
  role: z.enum(['TEACHER', 'STUDENT']).default('STUDENT'),
  classLevelId: z.string().optional().nullable(),
  establishment: z.string().trim().max(120).optional().nullable(),
  region: z.string().trim().max(60).optional().nullable(),
  ief: z.string().trim().max(120).optional().nullable(),
  ia: z.string().trim().max(120).optional().nullable(),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Mot de passe requis.') });

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  locale: z.enum(['fr', 'wo', 'ar']).optional(),
  classLevelId: z.string().nullable().optional(),
  establishment: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(60).nullable().optional(),
  ief: z.string().trim().max(120).nullable().optional(),
  ia: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});

export const mediaTypeSchema = z.enum(['VIDEO', 'AUDIO']);
export const languageSchema = z.enum(['FR', 'WO', 'AR', 'EN']);
export const difficultySchema = z.enum(['DECOUVERTE', 'INTERMEDIAIRE', 'APPROFONDISSEMENT']);

const keywordsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean).slice(0, 20));

// Métadonnées pédagogiques obligatoires pour un média publié par un administrateur.
export const mediaMetadataSchema = z.object({
  title: z.string().trim().min(3, 'Titre trop court (3 caractères minimum).').max(160),
  description: z.string().trim().min(10, 'Description trop courte (10 caractères minimum).').max(5000),
  type: mediaTypeSchema,
  cycleId: z.string().min(1, 'Cycle requis.'),
  classLevelId: z.string().min(1, 'Classe requise.'),
  disciplineId: z.string().min(1, 'Discipline requise.'),
  themeId: z.string().min(1, 'Thématique requise.'),
  chapter: z.string().trim().min(1, 'Chapitre requis.').max(160),
  keywords: keywordsSchema,
  language: languageSchema.default('FR'),
  license: z.string().trim().min(1).max(80).default('CC BY-NC-SA 4.0'),
  pedagogicalAuthor: z.string().trim().min(1, 'Auteur pédagogique requis.').max(160),
  difficulty: difficultySchema.default('INTERMEDIAIRE'),
  channelId: z.string().min(1, 'Chaîne requise.'),
  downloadable: z.coerce.boolean().default(false),
  publishImmediately: z.coerce.boolean().default(true),
  transcript: z.string().trim().max(200000).optional().nullable(),
  youtubeUrl: z.string().trim().max(500).optional().nullable(),
});

export const mediaUpdateSchema = mediaMetadataSchema.partial().omit({ type: true, publishImmediately: true });

export const youtubeMediaSchema = mediaMetadataSchema.extend({
  type: z.literal('VIDEO').default('VIDEO'),
  youtubeUrl: z.string().trim().min(8, 'Indiquez le lien YouTube de la vidéo.'),
});

export const youtubePreviewSchema = z.object({
  url: z.string().trim().min(8, 'Indiquez un lien YouTube.'),
});

export const youtubeImportSchema = z.object({
  cycleId: z.string().min(1, 'Cycle requis.'),
  classLevelId: z.string().min(1, 'Classe requise.'),
  disciplineId: z.string().min(1, 'Discipline requise.'),
  themeId: z.string().min(1, 'Thématique requise.'),
  chapter: z.string().trim().max(160).optional().default('Chaîne officielle SIMEN'),
  keywords: keywordsSchema.optional().default(['SIMEN', 'MEN']),
  language: languageSchema.default('FR'),
  license: z.string().trim().min(1).max(80).default('Tous droits réservés — MEN'),
  pedagogicalAuthor: z.string().trim().max(160).optional().default('SIMEN — Ministère de l’Éducation nationale'),
  difficulty: difficultySchema.default('INTERMEDIAIRE'),
  channelId: z.string().min(1, 'Chaîne requise.'),
  publishImmediately: z.coerce.boolean().default(true),
  fromOfficialChannel: z.coerce.boolean().default(false),
  urls: z.array(z.string().trim()).max(50).optional().default([]),
});

// Proposition (enseignant/élève) : formulaire simplifié.
export const submissionSchema = z.object({
  title: z.string().trim().min(3, 'Titre trop court.').max(160),
  description: z.string().trim().min(10, 'Décrivez votre proposition (10 caractères minimum).').max(3000),
  type: mediaTypeSchema,
  cycleId: z.string().min(1, 'Cycle requis.'),
  classLevelId: z.string().min(1, 'Classe requise.'),
  disciplineId: z.string().min(1, 'Discipline requise.'),
  themeId: z.string().min(1, 'Thématique requise.'),
  chapter: z.string().trim().max(160).optional().nullable(),
  keywords: keywordsSchema.optional().default([]),
  language: languageSchema.default('FR'),
  sourceUrl: z.string().trim().url('Lien invalide.').max(500).optional().or(z.literal('')).nullable(),
});

export const submissionReviewSchema = z.object({
  note: z.string().trim().max(2000).optional().nullable(),
  // À l'approbation, l'administrateur peut compléter/corriger les métadonnées obligatoires.
  overrides: mediaUpdateSchema.optional(),
});

export const rejectSchema = z.object({ reason: z.string().trim().min(5, 'Merci d\'indiquer un motif (5 caractères minimum).').max(2000) });

export const commentSchema = z.object({
  content: z.string().trim().min(2, 'Commentaire trop court.').max(2000, 'Commentaire trop long (2000 caractères max).'),
  parentId: z.string().optional().nullable(),
});

export const reportSchema = z.object({
  targetType: z.enum(['MEDIA', 'COMMENT']),
  targetId: z.string().min(1),
  reason: z.enum(['CONTENU_INAPPROPRIE', 'ERREUR_PEDAGOGIQUE', 'DROITS_AUTEUR', 'HARCELEMENT', 'SPAM', 'AUTRE']),
  details: z.string().trim().max(2000).optional().nullable(),
});

export const reportResolveSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolution: z.string().trim().max(2000).optional().nullable(),
  // Action optionnelle sur la cible : masquer un commentaire / archiver un média
  action: z.enum(['NONE', 'HIDE_TARGET']).default('NONE'),
});

export const recommendSchema = z
  .object({
    recipientId: z.string().optional().nullable(),
    recipientEmail: emailSchema.optional().nullable(),
    classLevelId: z.string().optional().nullable(),
    message: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.recipientId || v.recipientEmail || v.classLevelId, {
    message: 'Indiquez un destinataire (utilisateur) ou une classe.',
  });

export const progressSchema = z.object({
  positionSec: z.number().int().min(0),
  durationSec: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export const playlistSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  isPublic: z.boolean().default(false),
});

export const playlistItemSchema = z.object({ mediaId: z.string().min(1) });

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: mediaTypeSchema.optional(),
  cycle: z.string().optional(),
  classe: z.string().optional(),
  discipline: z.string().optional(),
  theme: z.string().optional(),
  langue: languageSchema.optional(),
  niveau: difficultySchema.optional(),
  duree: z.enum(['court', 'moyen', 'long']).optional(), // <5 min, 5-20, >20
  depuis: z.enum(['7j', '30j', '365j']).optional(),
  chaine: z.string().optional(),
  tri: z.enum(['recent', 'populaire', 'aime', 'pertinence']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  classLevelId: z.string().nullable().optional(),
  establishment: z.string().max(120).nullable().optional(),
  region: z.string().max(60).nullable().optional(),
  ief: z.string().max(120).nullable().optional(),
  ia: z.string().max(120).nullable().optional(),
  newPassword: passwordSchema.optional(),
});

export const adminCreateUserSchema = registerSchema.extend({ role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']) });

export const taxonomySchema = z.object({
  code: z.string().trim().min(1).max(30).regex(/^[A-Z0-9_\-]+$/, 'Code en majuscules sans espaces.'),
  name: z.string().trim().min(1).max(80),
  order: z.coerce.number().int().optional(),
  cycleId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(300).optional().nullable(),
});

export const channelSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  isOfficial: z.boolean().default(false),
  ownerId: z.string().optional(),
});

export const settingsSchema = z.record(z.string(), z.string().max(500));

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
