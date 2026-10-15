import type { StudyState } from '../domain/study';
export function toggleFavorite(state: StudyState, courseId: string): StudyState {
  return {
    ...state,
    favorites: state.favorites.includes(courseId)
      ? state.favorites.filter((id) => id !== courseId)
      : [...state.favorites, courseId],
  };
}
export function saveNote(state: StudyState, lessonId: string, text: string): StudyState {
  return { ...state, notes: { ...state.notes, [lessonId]: text } };
}
