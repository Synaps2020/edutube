import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Course } from '../domain/course';
import { emptyStudy, type StudyState } from '../domain/study';
import { api } from '../adapters/http/runtime';
import { allPages } from '../adapters/http/personal';
import { NoteWriter } from '../application/note-writer';
import { registerPendingChanges } from '../application/pending-changes';
import {
  StudyContextToken as Context,
  type StudyContext,
  type NotebookEntry,
} from './study-context';
export function StudyProvider({
  accountId,
  children,
}: {
  accountId: string | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<StudyState>(emptyStudy);
  const [loading, setLoading] = useState(!!accountId);
  const [storageError, setStorageError] = useState('');
  const [noteEntries, setNoteEntries] = useState<NotebookEntry[]>([]);
  const [pendingFavorites, setPendingFavorites] = useState<string[]>([]);
  const [noteStatus, setNoteStatus] = useState<StudyContext['noteStatus']>({});
  const [noteReady, setNoteReady] = useState<Record<string, boolean>>({});
  const writer = useRef<NoteWriter | null>(null);
  const visited = useRef('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    if (!accountId) {
      setLoading(false);
      return () => {
        active.current = false;
      };
    }
    const notes = new NoteWriter(api.notes, {
      status: (lessonId, status, message) =>
        setNoteStatus((previous) => ({ ...previous, [lessonId]: { status, message } })),
      saved: (note) => {
        setNoteEntries((previous) =>
          previous.map((item) =>
            item.lessonId === note.lessonId ? { ...item, ...note, text: item.text } : item,
          ),
        );
      },
    });
    writer.current = notes;
    const unregister = registerPendingChanges(() => notes.flushAll());
    const protect = (event: BeforeUnloadEvent) => {
      if (notes.hasPending()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', protect);
    Promise.all([
      allPages((page) =>
        api.favorites.list({ page, pageSize: 100 }, { signal: controller.signal }),
      ),
      allPages((page) => api.notes.list({ page, pageSize: 100 }, { signal: controller.signal })),
      allPages((page) =>
        api.quizzes.attempts({ page, pageSize: 100 }, { signal: controller.signal }),
      ),
      api.progress.resume({ signal: controller.signal }),
    ])
      .then(([favorites, entries, attempts, resume]) => {
        if (controller.signal.aborted) {
          return;
        }
        const scores: Record<string, number> = {};
        for (const attempt of attempts) {
          if (scores[attempt.courseId] === undefined) {
            scores[attempt.courseId] = attempt.scorePercent;
          }
        }
        setState((previous) => ({
          favorites: favorites.map((item) => item.course.id),
          notes: Object.fromEntries(entries.map((note) => [note.lessonId, note.text])),
          quizScores: { ...scores, ...previous.quizScores },
          lastLesson: previous.lastLesson ?? resume,
        }));
        setNoteEntries(entries);
        for (const entry of entries) {
          notes.restore(entry.lessonId, entry);
        }
        setStorageError('');
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setStorageError(
            failure instanceof Error ? failure.message : 'Votre espace est indisponible.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => {
      active.current = false;
      controller.abort();
      notes.dispose();
      unregister();
      window.removeEventListener('beforeunload', protect);
      writer.current = null;
    };
  }, [accountId]);
  const loadNote = useCallback(
    async (lessonId: string) => {
      if (!accountId || !writer.current || writer.current.dirty(lessonId)) {
        return;
      }
      const current = await api.notes.get(lessonId);
      if (!active.current || writer.current?.dirty(lessonId)) {
        return;
      }
      writer.current?.restore(lessonId, current);
      setState((previous) => ({
        ...previous,
        notes: { ...previous.notes, [lessonId]: current?.text ?? '' },
      }));
      if (current) {
        setNoteStatus((previous) => ({ ...previous, [lessonId]: { status: 'saved' } }));
      }
      setNoteReady((previous) => ({ ...previous, [lessonId]: true }));
    },
    [accountId],
  );
  const visit = useCallback(
    (courseId: string, lessonId: string) => {
      if (!accountId || visited.current === `${courseId}:${lessonId}`) {
        return;
      }
      visited.current = `${courseId}:${lessonId}`;
      void api.progress
        .visit(courseId, lessonId)
        .then((resume) => {
          if (active.current) {
            setState((previous) => ({ ...previous, lastLesson: resume }));
          }
        })
        .catch((failure: unknown) => {
          visited.current = '';
          if (active.current) {
            setStorageError(
              failure instanceof Error
                ? failure.message
                : 'Votre dernière étape n’a pas été enregistrée.',
            );
          }
        });
    },
    [accountId],
  );
  const favorite = (id: string) => {
    if (!accountId || pendingFavorites.includes(id)) {
      return;
    }
    setPendingFavorites((previous) => [...previous, id]);
    setStorageError('');
    const saved = state.favorites.includes(id);
    void (saved ? api.favorites.remove(id) : api.favorites.save(id))
      .then(() => {
        if (active.current) {
          setState((previous) => ({
            ...previous,
            favorites: saved
              ? previous.favorites.filter((item) => item !== id)
              : [...new Set([...previous.favorites, id])],
          }));
        }
      })
      .catch((failure: unknown) => {
        if (active.current) {
          setStorageError(failure instanceof Error ? failure.message : 'Favori non enregistré.');
        }
      })
      .finally(() => {
        if (active.current) {
          setPendingFavorites((previous) => previous.filter((item) => item !== id));
        }
      });
  };
  const note = (course: Course, lessonId: string, text: string) => {
    if (!noteReady[lessonId] || !writer.current) {
      return;
    }
    setState((previous) => ({ ...previous, notes: { ...previous.notes, [lessonId]: text } }));
    setNoteEntries((previous) => {
      const entry = previous.find((item) => item.lessonId === lessonId);
      return entry
        ? previous.map((item) => (item.lessonId === lessonId ? { ...item, text } : item))
        : [
            ...previous,
            {
              courseId: course.id,
              lessonId,
              text,
              courseTitle: course.title,
              lessonTitle:
                course.lessons.find((item) => item.id === lessonId)?.title ?? course.title,
              subject: { name: course.subject },
            },
          ];
    });
    writer.current.change(lessonId, text);
  };
  const resolveNote = async (lessonId: string, choice: 'retry' | 'reload' | 'keep') => {
    if (!writer.current) {
      return;
    }
    if (choice === 'retry') {
      await writer.current.retry(lessonId);
      return;
    }
    const current = await api.notes.get(lessonId);
    if (choice === 'keep') {
      await writer.current.keepDraft(lessonId, current);
      return;
    }
    writer.current.replace(lessonId, current);
    setState((previous) => ({
      ...previous,
      notes: { ...previous.notes, [lessonId]: current?.text ?? '' },
    }));
    setNoteEntries((previous) =>
      previous.flatMap((item) =>
        item.lessonId === lessonId ? (current ? [{ ...item, ...current }] : []) : [item],
      ),
    );
  };
  const flushNote = useCallback(async (lessonId: string) => {
    await writer.current?.flush(lessonId);
  }, []);
  return (
    <Context.Provider
      value={{
        state,
        noteEntries,
        loading,
        storageError,
        pendingFavorites,
        noteStatus,
        noteReady,
        favorite,
        note,
        loadNote,
        resolveNote,
        flushNote,
        score: (courseId, percent) =>
          setState((previous) => ({
            ...previous,
            quizScores: { ...previous.quizScores, [courseId]: percent },
          })),
        visit,
      }}
    >
      {storageError && (
        <div className="notice" role="alert">
          {storageError}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
