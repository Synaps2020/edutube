import { createContext, useContext } from 'react';
import type { Course } from '../domain/course';
import type { StudyState } from '../domain/study';
import type { NoteStatus } from '../application/note-writer';
export interface NotebookEntry {
  courseId: string;
  lessonId: string;
  text: string;
  courseTitle: string;
  lessonTitle: string;
  subject: { name: string };
}
export interface StudyContext {
  state: StudyState;
  noteEntries: NotebookEntry[];
  loading: boolean;
  storageError: string;
  pendingFavorites: string[];
  noteReady: Record<string, boolean>;
  noteStatus: Record<string, { status: NoteStatus; message?: string }>;
  favorite(id: string): void;
  note(course: Course, lessonId: string, text: string): void;
  loadNote(lessonId: string): Promise<void>;
  flushNote(lessonId: string): Promise<void>;
  resolveNote(lessonId: string, choice: 'retry' | 'reload' | 'keep'): Promise<void>;
  score(courseId: string, percent: number): void;
  visit(courseId: string, lessonId: string): void;
}
export const StudyContextToken = createContext<StudyContext | null>(null);
export function useStudy() {
  const context = useContext(StudyContextToken);
  if (!context) {
    throw new Error('StudyProvider manquant');
  }
  return context;
}
