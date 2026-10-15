import {
  adminOverviewSchema,
  adminAccountsSchema,
  adminCoursesSchema,
  adminJournalSchema,
  adminAccountSchema,
  adminCourseSchema,
  adminQuerySchema,
  accountChangeSchema,
  accountCreateSchema,
  moderationSchema,
} from './administration';
import { videoSchema, videoStateSchema, videoMutationSchema, lessonAccessSchema } from './videos';
import {
  profileSchema,
  profileInputSchema,
  emailInputSchema,
  tokenInputSchema,
  resetInputSchema,
  noticeSchema,
} from './identity';
import { z } from 'zod';
import {
  teachingSummarySchema,
  teachingCourseSchema,
  teachingContentSchema,
  teachingSaveSchema,
  teachingStatusSchema,
} from './teaching';
import { resourceUploadSchema, resourceRemoveSchema, teachingResourcesSchema } from './resources';
import * as schemas from './index';
export interface Operation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary: string;
  authenticated: boolean;
  response: z.ZodTypeAny;
  query?: z.AnyZodObject;
  body?: z.ZodTypeAny;
  status: number;
  binary?: boolean;
  multipart?: boolean;
}
const operation = <T extends z.ZodTypeAny>(
  method: Operation['method'],
  path: string,
  summary: string,
  response: T,
  options: Partial<Omit<Operation, 'method' | 'path' | 'summary' | 'response'>> = {},
) => ({ method, path, summary, response, authenticated: false, status: 200, ...options });
export const operations = {
  adminOverview: operation(
    'GET',
    '/administration/overview',
    'Consulter le tableau de bord',
    adminOverviewSchema,
    { authenticated: true },
  ),
  adminReview: operation(
    'GET',
    '/administration/courses/{courseId}',
    'Examiner un cours',
    teachingCourseSchema,
    { authenticated: true },
  ),
  adminVideo: operation(
    'GET',
    '/administration/courses/{courseId}/lessons/{lessonId}/video',
    'Examiner une vidéo',
    videoSchema.nullable(),
    { authenticated: true },
  ),
  adminVideoFile: operation(
    'GET',
    '/administration/courses/{courseId}/lessons/{lessonId}/video/files/{assetName}',
    'Lire un média pour modération',
    z.unknown(),
    { authenticated: true, binary: true },
  ),
  adminAccounts: operation(
    'GET',
    '/administration/accounts',
    'Consulter les comptes',
    adminAccountsSchema,
    { authenticated: true, query: adminQuerySchema },
  ),
  adminCreateAccount: operation(
    'POST',
    '/administration/accounts',
    'Inviter un compte',
    adminAccountSchema,
    { authenticated: true, body: accountCreateSchema, status: 201 },
  ),
  adminChangeAccount: operation(
    'PUT',
    '/administration/accounts/{accountId}',
    'Modifier les droits et l’accès',
    adminAccountSchema,
    { authenticated: true, body: accountChangeSchema },
  ),
  adminCourses: operation(
    'GET',
    '/administration/courses',
    'Contrôler les contenus',
    adminCoursesSchema,
    { authenticated: true, query: adminQuerySchema },
  ),
  adminModerate: operation(
    'PUT',
    '/administration/courses/{courseId}',
    'Modérer un cours',
    adminCourseSchema,
    { authenticated: true, body: moderationSchema },
  ),
  adminJournal: operation(
    'GET',
    '/administration/journal',
    'Consulter les interventions',
    adminJournalSchema,
    { authenticated: true, query: adminQuerySchema },
  ),
  video: operation(
    'GET',
    '/courses/{courseId}/lessons/{lessonId}/video',
    'Lire la vidéo du chapitre',
    videoSchema.nullable(),
  ),
  videoFile: operation(
    'GET',
    '/courses/{courseId}/lessons/{lessonId}/video/files/{assetName}',
    'Lire un segment vidéo autorisé',
    z.unknown(),
    { binary: true },
  ),
  teachingVideo: operation(
    'GET',
    '/teaching/courses/{courseId}/lessons/{lessonId}/video',
    'Lire ma vidéo et sa préparation',
    videoStateSchema,
    { authenticated: true },
  ),
  uploadVideo: operation(
    'POST',
    '/teaching/courses/{courseId}/lessons/{lessonId}/video',
    'Joindre une vidéo MP4',
    videoStateSchema,
    { authenticated: true, multipart: true, body: videoMutationSchema, status: 202 },
  ),
  removeVideo: operation(
    'DELETE',
    '/teaching/courses/{courseId}/lessons/{lessonId}/video',
    'Retirer la vidéo du chapitre',
    videoStateSchema,
    { authenticated: true, body: videoMutationSchema },
  ),
  lessonAccess: operation(
    'GET',
    '/courses/{courseId}/access',
    'Lire les chapitres accessibles et le seuil de l’examen',
    lessonAccessSchema,
  ),
  profile: operation('GET', '/me/profile', 'Lire mon profil', profileSchema, {
    authenticated: true,
  }),
  saveProfile: operation('PUT', '/me/profile', 'Modifier mon profil', profileSchema, {
    authenticated: true,
    body: profileInputSchema,
  }),
  requestVerification: operation(
    'POST',
    '/auth/verification/request',
    'Envoyer un lien de vérification',
    noticeSchema,
    { authenticated: true },
  ),
  verifyEmail: operation(
    'POST',
    '/auth/verification/confirm',
    'Vérifier mon adresse e-mail',
    noticeSchema,
    { body: tokenInputSchema },
  ),
  forgotPassword: operation(
    'POST',
    '/auth/password/forgot',
    'Demander un nouveau mot de passe',
    noticeSchema,
    { body: emailInputSchema },
  ),
  resetPassword: operation(
    'POST',
    '/auth/password/reset',
    'Remplacer un mot de passe oublié',
    noticeSchema,
    { body: resetInputSchema },
  ),
  teachingResources: operation(
    'GET',
    '/teaching/courses/{courseId}/lessons/{lessonId}/resources',
    'Lire les documents de mon chapitre',
    teachingResourcesSchema,
    { authenticated: true },
  ),
  uploadResource: operation(
    'POST',
    '/teaching/courses/{courseId}/lessons/{lessonId}/resources',
    'Joindre un PDF ou un texte à mon chapitre',
    teachingResourcesSchema,
    { authenticated: true, body: resourceUploadSchema, multipart: true, status: 201 },
  ),
  removeResource: operation(
    'DELETE',
    '/teaching/courses/{courseId}/lessons/{lessonId}/resources/{resourceId}',
    'Retirer un document de mon chapitre',
    teachingResourcesSchema,
    { authenticated: true, body: resourceRemoveSchema },
  ),
  teachingCourses: operation(
    'GET',
    '/teaching/courses',
    'Lister mes cours',
    z.array(teachingSummarySchema),
    { authenticated: true },
  ),
  teachingCourse: operation(
    'GET',
    '/teaching/courses/{courseId}',
    'Lire mon cours et ses corrections',
    teachingCourseSchema,
    { authenticated: true },
  ),
  teachingCreate: operation(
    'POST',
    '/teaching/courses',
    'Créer un brouillon',
    teachingCourseSchema,
    { authenticated: true, body: teachingContentSchema, status: 201 },
  ),
  teachingSave: operation(
    'PUT',
    '/teaching/courses/{courseId}',
    'Enregistrer mon cours',
    teachingCourseSchema,
    { authenticated: true, body: teachingSaveSchema },
  ),
  teachingStatus: operation(
    'PUT',
    '/teaching/courses/{courseId}/status',
    'Publier, retirer ou archiver mon cours',
    teachingCourseSchema,
    { authenticated: true, body: teachingStatusSchema },
  ),
  login: operation('POST', '/auth/login', 'Se connecter', schemas.sessionSchema, {
    body: schemas.loginInputSchema,
  }),
  register: operation('POST', '/auth/register', 'Créer un compte', schemas.sessionSchema, {
    body: schemas.registerInputSchema,
    status: 201,
  }),
  logout: operation('POST', '/auth/logout', 'Se déconnecter', z.undefined(), {
    authenticated: true,
    status: 204,
  }),
  taxonomy: operation('GET', '/taxonomy', 'Lire les matières et niveaux', schemas.taxonomySchema),
  courses: operation(
    'GET',
    '/courses',
    'Rechercher et paginer les cours',
    schemas.pageSchema(schemas.courseSummarySchema),
    { query: schemas.courseQuerySchema },
  ),
  course: operation(
    'GET',
    '/courses/{courseId}',
    'Lire une fiche de cours',
    schemas.courseDetailSchema,
  ),
  paths: operation(
    'GET',
    '/learning-paths',
    'Lister les parcours',
    schemas.pageSchema(schemas.pathSummarySchema),
    {
      query: schemas.pathQuerySchema,
    },
  ),
  path: operation(
    'GET',
    '/learning-paths/{pathId}',
    'Lire les étapes ordonnées',
    schemas.pathDetailSchema,
  ),
  lesson: operation(
    'GET',
    '/courses/{courseId}/lessons/{lessonId}',
    'Lire un chapitre : aperçu public, puis session obligatoire',
    schemas.lessonContentSchema,
  ),
  session: operation(
    'GET',
    '/auth/session',
    'Lire la session et son jeton CSRF',
    schemas.sessionSchema,
    {
      authenticated: true,
    },
  ),
  me: operation('GET', '/me', 'Lire le profil de la session', schemas.learnerSchema, {
    authenticated: true,
  }),
  dashboard: operation('GET', '/me/dashboard', 'Lire le bilan personnel', schemas.dashboardSchema, {
    authenticated: true,
  }),
  enrollments: operation(
    'GET',
    '/me/enrollments',
    'Lire la bibliothèque apprenant',
    schemas.pageSchema(schemas.enrollmentViewSchema),
    { query: schemas.pageQuerySchema, authenticated: true },
  ),
  enroll: operation(
    'POST',
    '/me/enrollments',
    'Inscrire au cours sans duplication',
    schemas.enrollmentViewSchema,
    { body: schemas.enrollmentInputSchema, authenticated: true, status: 201 },
  ),
  enrollPath: operation(
    'POST',
    '/me/learning-path-enrollments',
    'Inscrire atomiquement aux étapes du parcours',
    z
      .object({ pathId: schemas.idSchema, enrollments: z.array(schemas.enrollmentViewSchema) })
      .strict(),
    { body: schemas.pathEnrollmentInputSchema, authenticated: true, status: 201 },
  ),
  progress: operation(
    'GET',
    '/me/courses/{courseId}/progress',
    'Lire la progression calculée',
    schemas.courseProgressSchema,
    { authenticated: true },
  ),
  complete: operation(
    'PUT',
    '/me/courses/{courseId}/lessons/{lessonId}/progress',
    'Terminer ou rouvrir un chapitre',
    schemas.courseProgressSchema,
    { body: schemas.progressInputSchema, authenticated: true },
  ),
  pathProgress: operation(
    'GET',
    '/me/learning-paths/{pathId}/progress',
    'Lire la progression du parcours',
    schemas.pathProgressSchema,
    { authenticated: true },
  ),
  resume: operation(
    'GET',
    '/me/resume',
    'Lire la dernière étape visitée',
    schemas.resumeSchema.nullable(),
    {
      authenticated: true,
    },
  ),
  visit: operation('PUT', '/me/resume', 'Enregistrer la dernière étape', schemas.resumeSchema, {
    body: schemas.resumeInputSchema,
    authenticated: true,
  }),
  favorites: operation(
    'GET',
    '/me/favorites',
    'Lire les cours enregistrés',
    schemas.pageSchema(schemas.favoriteSchema),
    { query: schemas.courseQuerySchema, authenticated: true },
  ),
  saveFavorite: operation(
    'PUT',
    '/me/favorites/{courseId}',
    'Enregistrer un favori sans duplication',
    schemas.favoriteSchema,
    { authenticated: true },
  ),
  deleteFavorite: operation(
    'DELETE',
    '/me/favorites/{courseId}',
    'Retirer un favori de façon idempotente',
    z.void(),
    { authenticated: true, status: 204 },
  ),
  notes: operation(
    'GET',
    '/me/notes',
    'Lire le carnet paginé',
    schemas.pageSchema(schemas.noteSummarySchema),
    {
      query: schemas.pageQuerySchema,
      authenticated: true,
    },
  ),
  note: operation(
    'GET',
    '/me/lessons/{lessonId}/note',
    'Lire la note du chapitre',
    schemas.noteSchema.nullable(),
    { authenticated: true },
  ),
  saveNote: operation(
    'PUT',
    '/me/lessons/{lessonId}/note',
    'Enregistrer la note avec contrôle de version',
    schemas.noteSchema,
    { body: schemas.noteInputSchema, authenticated: true },
  ),
  quiz: operation(
    'GET',
    '/courses/{courseId}/quiz',
    'Lire le quiz sans corrigé',
    schemas.quizSchema,
  ),
  attempt: operation(
    'POST',
    '/me/quizzes/{quizId}/attempts',
    'Soumettre les réponses pour correction serveur',
    schemas.quizAttemptSchema,
    { body: schemas.attemptInputSchema, authenticated: true, status: 201 },
  ),
  attempts: operation(
    'GET',
    '/me/quiz-attempts',
    'Lire les dernières tentatives',
    schemas.pageSchema(schemas.quizAttemptSummarySchema),
    { query: schemas.pageQuerySchema, authenticated: true },
  ),
  resources: operation(
    'GET',
    '/courses/{courseId}/lessons/{lessonId}/resources',
    'Lire les ressources autorisées',
    z.array(schemas.resourceSchema),
  ),
  download: operation(
    'GET',
    '/resources/{resourceId}/download',
    'Télécharger une pièce autorisée',
    z.unknown(),
    { binary: true },
  ),
} satisfies Record<string, Operation>;
