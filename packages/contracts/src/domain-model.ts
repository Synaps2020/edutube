/** Modèle métier prévu pour la suite. Ce fichier décrit les données, sans créer de serveur. */
declare const entityKind: unique symbol;
export type EntityId<K extends string> = string & { readonly [entityKind]: K };
export type IsoInstant = string;
export type LearnerId = EntityId<'Learner'>;
export type CourseId = EntityId<'Course'>;
export type LessonId = EntityId<'Lesson'>;
export type QuizId = EntityId<'Quiz'>;
export interface Learner {
  id: LearnerId;
  displayName: string;
  schoolLevel: 'PRIMARY' | 'MIDDLE' | 'SECONDARY' | null;
}
export interface Subject {
  id: EntityId<'Subject'>;
  code: string;
  name: string;
}
export interface Instructor {
  id: EntityId<'Instructor'>;
  displayName: string;
  avatarResourceId: EntityId<'Resource'> | null;
}
export interface Course {
  id: CourseId;
  slug: string;
  title: string;
  description: string;
  subjectId: Subject['id'];
  instructorId: Instructor['id'];
  schoolLevel: 'PRIMARY' | 'MIDDLE' | 'SECONDARY';
  language: 'fr' | 'wo' | 'ar' | 'en';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  outcomes: readonly string[];
  prerequisites: readonly string[];
  curriculumRevision: number;
  publishedAt: IsoInstant | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}
export interface Lesson {
  id: LessonId;
  courseId: CourseId;
  title: string;
  order: number;
  kind: 'VIDEO' | 'READING' | 'PRACTICE';
  estimatedMinutes: number;
  previewAllowed: boolean;
  requiresQuiz: boolean;
  contentRevision: number;
}
export interface LessonBlock {
  id: EntityId<'LessonBlock'>;
  lessonId: LessonId;
  order: number;
  type: 'PARAGRAPH' | 'EXAMPLE';
  title: string | null;
  text: string;
}
export interface LearningPath {
  id: EntityId<'LearningPath'>;
  slug: string;
  title: string;
  description: string;
  goal: 'EXAM' | 'DISCOVERY' | 'FOUNDATIONS';
  revision: number;
}
export interface PathStep {
  id: EntityId<'PathStep'>;
  pathId: LearningPath['id'];
  courseId: CourseId;
  order: number;
}
export interface Enrollment {
  id: EntityId<'Enrollment'>;
  learnerId: LearnerId;
  courseId: CourseId;
  enrolledAt: IsoInstant;
  completedAt: IsoInstant | null;
}
export interface LessonProgress {
  learnerId: LearnerId;
  lessonId: LessonId;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt: IsoInstant | null;
  updatedAt: IsoInstant;
}
export interface Favorite {
  learnerId: LearnerId;
  courseId: CourseId;
  savedAt: IsoInstant;
}
export interface LessonNote {
  id: EntityId<'LessonNote'>;
  learnerId: LearnerId;
  lessonId: LessonId;
  text: string;
  version: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}
export interface Resume {
  learnerId: LearnerId;
  lessonId: LessonId;
  visitedAt: IsoInstant;
}
export interface Resource {
  id: EntityId<'Resource'>;
  lessonId: LessonId;
  title: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number | null;
  storageObjectId: string;
}
/** Les bonnes réponses restent côté serveur et ne sont pas envoyées avec les questions. */
export interface QuizRevision {
  passingScore: number;
  quizId: QuizId;
  courseId: CourseId;
  revision: number;
  title: string;
  questions: readonly QuizQuestion[];
}
export interface QuizQuestion {
  id: EntityId<'QuizQuestion'>;
  prompt: string;
  options: readonly { id: EntityId<'QuizOption'>; text: string }[];
  correctOptionId: EntityId<'QuizOption'>;
  explanation: string;
}
export interface QuizAttempt {
  id: EntityId<'QuizAttempt'>;
  learnerId: LearnerId;
  quizId: QuizId;
  quizRevision: number;
  submittedAt: IsoInstant;
  answers: readonly { questionId: QuizQuestion['id']; optionId: EntityId<'QuizOption'> }[];
  correctionSnapshot: readonly {
    questionId: QuizQuestion['id'];
    prompt: string;
    selectedText: string;
    correctText: string;
    correct: boolean;
    explanation: string;
  }[];
}
/** Une demande rejouée est reconnue pour un apprenant et une action précis. */
export interface IdempotencyRecord {
  learnerId: LearnerId;
  operation: string;
  key: string;
  requestFingerprint: string;
  resultReference: string;
  expiresAt: IsoInstant;
}

/** Les références du stockage restent privées et indépendantes du fournisseur. */
export interface Video {
  id: EntityId<'Video'>;
  courseId: CourseId;
  lessonId: LessonId;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'REMOVED';
  fileName: string;
  sizeBytes: number;
  durationSeconds: number | null;
  storageDriver: string;
  sourceKey: string;
  createdAt: IsoInstant;
}
export interface VideoAsset {
  videoId: Video['id'];
  name: string;
  storageKey: string;
  mediaType: string;
  sizeBytes: number;
}
