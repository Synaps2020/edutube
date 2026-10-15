import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { legacyData, importLegacy } from './legacy-import';
import { api } from './runtime';
import { HttpError } from './client';
import type { CourseDetailDto, EnrollmentViewDto, NoteDto } from '@edutube/contracts';
vi.mock('./runtime', () => ({
  api: {
    auth: { session: vi.fn() },
    enrollments: { enroll: vi.fn() },
    catalog: { get: vi.fn() },
    progress: { setCompleted: vi.fn(), resume: vi.fn(), visit: vi.fn() },
    favorites: { save: vi.fn() },
    notes: { get: vi.fn(), save: vi.fn() },
  },
}));
vi.mock('./services', () => ({ createApiServices: () => api }));
const session = {
  learner: {
    id: 'account-1',
    displayName: 'Apprenant',
    schoolLevel: null,
    role: 'LEARNER' as const,
  },
  csrfToken: 'session-account-1',
  expiresAt: '2026-10-21T10:00:00.000Z',
};
const timestamp = '2026-10-14T10:00:00.000Z';
const course: CourseDetailDto = {
  id: 'thales',
  slug: 'thales',
  title: 'Thalès',
  shortDescription: 'Les triangles',
  description: 'Un cours de géométrie',
  subject: { id: 'maths', code: 'MATH', name: 'Mathématiques' },
  schoolLevel: 'MIDDLE',
  instructor: { id: 'teacher', displayName: 'Enseignant', avatarUrl: null },
  durationMinutes: 20,
  lessonCount: 2,
  rating: { average: null, reviewCount: 0, enrollmentCount: 0 },
  cover: { imageUrl: null, alt: 'Triangles', illustration: 'geometry', palette: 'blue' },
  featured: false,
  publishedAt: timestamp,
  updatedAt: timestamp,
  revision: 1,
  outcomes: ['Lire une figure'],
  prerequisites: [],
  language: 'fr',
  lessons: ['thales-1', 'thales-2'].map((id, order) => ({
    id,
    courseId: 'thales',
    title: 'Chapitre',
    order,
    kind: 'READING',
    estimatedMinutes: 10,
    previewAllowed: true,
    resourceCount: 0,
  })),
};
const {
  revision: _revision,
  description: _description,
  outcomes: _outcomes,
  prerequisites: _prerequisites,
  language: _language,
  lessons: _lessons,
  ...summary
} = course;
const enrolled: EnrollmentViewDto = {
  course: summary,
  enrollment: {
    id: 'enrollment-1',
    courseId: 'thales',
    status: 'ACTIVE',
    enrolledAt: timestamp,
    completedAt: null,
  },
  progress: {
    courseId: 'thales',
    curriculumRevision: 1,
    completedLessonIds: [],
    totalLessons: 2,
    percent: 0,
    nextLessonId: 'thales-1',
    updatedAt: timestamp,
  },
};
const existing: NoteDto = {
  id: 'note-1',
  courseId: 'thales',
  lessonId: 'thales-1',
  text: 'Texte enregistré sur le serveur',
  version: 3,
  createdAt: timestamp,
  updatedAt: timestamp,
};
let stored: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.auth.session).mockResolvedValue(session);
  stored = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  stored.set(
    'edutube.learning.v1.account-1',
    JSON.stringify([{ courseId: 'thales', completedLessonIds: ['thales-2'] }]),
  );
  stored.set(
    'edutube.study.v1.account-1',
    JSON.stringify({
      favorites: ['thales'],
      notes: { 'thales-1': 'Ancienne note locale', 'thales-2': 'Une nouvelle note locale' },
      quizScores: { thales: 100 },
      lastLesson: null,
    }),
  );
  vi.mocked(api.enrollments.enroll).mockResolvedValue(enrolled);
  vi.mocked(api.catalog.get).mockResolvedValue(course);
  vi.mocked(api.progress.setCompleted).mockResolvedValue({
    ...enrolled.progress,
    completedLessonIds: ['thales-2'],
    percent: 50,
  });
  vi.mocked(api.favorites.save).mockResolvedValue({ course: summary, savedAt: timestamp });
  vi.mocked(api.notes.get).mockImplementation(async (id) => (id === 'thales-1' ? existing : null));
  vi.mocked(api.notes.save).mockImplementation(async (id, input) => ({
    ...existing,
    id: 'note-2',
    lessonId: id,
    text: input.text,
    version: 1,
  }));
});
afterEach(() => vi.unstubAllGlobals());
it('importe les données du même compte sans remplacer une note existante', async () => {
  expect(legacyData('account-1').available).toBe(true);
  const original = stored.get('edutube.study.v1.account-1');
  expect(await importLegacy(session)).toEqual({ skipped: 1 });
  expect(api.enrollments.enroll).toHaveBeenCalledWith('thales', {
    idempotencyKey: 'legacy:thales',
  });
  expect(api.progress.setCompleted).toHaveBeenCalledWith('thales', 'thales-2', true);
  expect(api.notes.save).toHaveBeenCalledTimes(1);
  expect(api.notes.save).toHaveBeenCalledWith('thales-2', {
    text: 'Une nouvelle note locale',
    expectedVersion: null,
  });
  expect(stored.get('edutube.study.v1.account-1')).toBe(original);
  expect(legacyData('account-1')).toMatchObject({ available: false, skipped: 1 });
});
it('ne propose pas les données d’un autre compte', () => {
  expect(legacyData('account-2')).toMatchObject({
    available: false,
    counts: { courses: 0, favorites: 0, notes: 0 },
  });
});
it('permet une reprise après une interruption sans effacer les données locales', async () => {
  vi.mocked(api.enrollments.enroll).mockRejectedValue(
    new HttpError(0, 'NETWORK_ERROR', 'Serveur indisponible'),
  );
  await expect(importLegacy(session)).rejects.toThrow('Serveur indisponible');
  expect(stored.has('edutube.imported.v1.account-1')).toBe(false);
  expect(legacyData('account-1').available).toBe(true);
  expect(stored.has('edutube.study.v1.account-1')).toBe(true);
});

it('refuse une reprise si le compte de la session a changé', async () => {
  vi.mocked(api.auth.session).mockResolvedValue({
    ...session,
    learner: { ...session.learner, id: 'account-2' },
  });
  await expect(importLegacy(session)).rejects.toThrow('La session a changé');
  expect(api.enrollments.enroll).not.toHaveBeenCalled();
});
