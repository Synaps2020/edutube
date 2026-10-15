import { DomainError } from './errors';
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}
export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  revision: number;
  questions: QuizQuestion[];
}
export function publicQuiz(quiz: Quiz) {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
    })),
  };
}
export function gradeQuiz(
  quiz: Quiz,
  revision: number,
  answers: { questionId: string; optionId: string }[],
) {
  if (quiz.revision !== revision) {
    throw new DomainError('CONFLICT', 'Cet exercice a changé. Rechargez les questions.');
  }
  if (
    answers.length !== quiz.questions.length ||
    new Set(answers.map((answer) => answer.questionId)).size !== answers.length
  ) {
    throw new DomainError('CONFLICT', 'Répondez une fois à chaque question.');
  }
  return quiz.questions.map((question) => {
    const answer = answers.find((item) => item.questionId === question.id);
    if (!answer || !question.options.some((option) => option.id === answer.optionId)) {
      throw new DomainError('CONFLICT', 'Une réponse ne correspond pas à cet exercice.');
    }
    return {
      questionId: question.id,
      selectedOptionId: answer.optionId,
      correctOptionId: question.correctOptionId,
      correct: answer.optionId === question.correctOptionId,
      explanation: question.explanation,
    };
  });
}
