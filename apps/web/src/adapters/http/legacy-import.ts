import { createLocalLearning } from '../local-learning';
import { createLocalStudy } from '../local-study';
import type { SessionDto } from '@edutube/contracts';
import { createApiServices } from './services';
import { HttpError } from './client';
import { registerPendingChanges } from '../../application/pending-changes';
import { flushPendingChanges } from '../../application/pending-changes';
const marker = (accountId: string) => `edutube.imported.v1.${accountId}`;
export function legacyData(accountId: string) {
  const enrollments = createLocalLearning(accountId).read();
  const study = createLocalStudy(accountId).read();
  const counts = {
    courses: enrollments.length,
    favorites: study.favorites.length,
    notes: Object.values(study.notes).filter((text) => text.trim()).length,
  };
  let imported = false;
  let skipped = 0;
  try {
    const value = localStorage.getItem(marker(accountId));
    imported = !!value;
    if (value) {
      try {
        const report: unknown = JSON.parse(value);
        if (
          report &&
          typeof report === 'object' &&
          'skipped' in report &&
          typeof report.skipped === 'number'
        ) {
          skipped = report.skipped;
        }
      } catch {
        skipped = 0;
      }
    }
  } catch {
    imported = false;
  }
  return {
    enrollments,
    study,
    counts,
    skipped,
    available:
      !imported && (!!study.lastLesson || Object.values(counts).some((count) => count > 0)),
  };
}
export async function importLegacy(session: SessionDto) {
  await flushPendingChanges();
  const task = performImport(session);
  const unregister = registerPendingChanges(async () => {
    await task;
  });
  try {
    return await task;
  } finally {
    unregister();
  }
}
async function performImport(session: SessionDto) {
  const accountId = session.learner.id;
  const api = createApiServices({ baseUrl: '/api/v1', csrfToken: () => session.csrfToken });
  const current = await api.auth.session();
  if (current.learner.id !== accountId) {
    throw new Error('La session a changé. Rechargez la page avant de reprendre l’import.');
  }
  const data = legacyData(accountId);
  let skipped = 0;
  const tryAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (failure) {
      if (failure instanceof HttpError && failure.status === 404) {
        skipped++;
      } else {
        throw failure;
      }
    }
  };
  for (const enrollment of data.enrollments) {
    await tryAction(async () => {
      const view = await api.enrollments.enroll(enrollment.courseId, {
        idempotencyKey: `legacy:${enrollment.courseId}`,
      });
      const course = await api.catalog.get(enrollment.courseId);
      for (const id of enrollment.completedLessonIds) {
        if (
          course.lessons.some((lesson) => lesson.id === id) &&
          !view.progress.completedLessonIds.includes(id)
        ) {
          await api.progress.setCompleted(enrollment.courseId, id, true);
        }
      }
    });
  }
  for (const id of data.study.favorites) {
    await tryAction(async () => {
      await api.favorites.save(id);
    });
  }
  for (const [id, text] of Object.entries(data.study.notes)) {
    if (!text.trim()) {
      continue;
    }
    if (text.length > 20000) {
      skipped++;
      continue;
    }
    await tryAction(async () => {
      if (await api.notes.get(id)) {
        skipped++;
        return;
      }
      try {
        await api.notes.save(id, { text, expectedVersion: null });
      } catch (failure) {
        if (failure instanceof HttpError && failure.code === 'REVISION_CONFLICT') {
          skipped++;
        } else {
          throw failure;
        }
      }
    });
  }
  if (data.study.lastLesson && !(await api.progress.resume())) {
    const last = data.study.lastLesson;
    await tryAction(async () => {
      await api.progress.visit(last.courseId, last.lessonId);
    });
  }
  try {
    localStorage.setItem(
      marker(accountId),
      JSON.stringify({ at: new Date().toISOString(), skipped }),
    );
  } catch {
    /* Les données d’origine restent disponibles si le navigateur refuse le repère. */
  }
  return { skipped };
}
