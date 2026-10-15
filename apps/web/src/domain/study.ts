export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
export interface CourseMaterial {
  prerequisites: string[];
  summary: string;
  example: string;
  questions: QuizQuestion[];
}
export interface StudyState {
  favorites: string[];
  notes: Record<string, string>;
  quizScores: Record<string, number>;
  lastLesson: { courseId: string; lessonId: string } | null;
}
export const emptyStudy: StudyState = {
  favorites: [],
  notes: {},
  quizScores: {},
  lastLesson: null,
};
export function gradeQuiz(questions: QuizQuestion[], answers: Record<string, number>) {
  const correct = questions.filter(
    (question) => answers[question.id] === question.correctIndex,
  ).length;
  return {
    correct,
    total: questions.length,
    percent: questions.length ? Math.round((correct / questions.length) * 100) : 0,
  };
}
