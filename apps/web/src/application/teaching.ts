import type { TeachingContent } from '@edutube/contracts/teaching';
export function newTeachingQuestion(): NonNullable<TeachingContent['quiz']>['questions'][number] {
  const correctOptionId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    prompt: 'Votre question',
    options: [
      { id: correctOptionId, text: 'Premier choix' },
      { id: crypto.randomUUID(), text: 'Deuxième choix' },
      { id: crypto.randomUUID(), text: 'Troisième choix' },
    ],
    correctOptionId,
    explanation: 'Expliquez pourquoi cette réponse est correcte.',
  };
}
export function newTeachingLesson(): TeachingContent['lessons'][number] {
  return {
    id: crypto.randomUUID(),
    title: 'Nouveau chapitre',
    kind: 'READING',
    estimatedMinutes: 10,
    previewAllowed: false,
    requiresQuiz: false,
    blocks: [{ type: 'PARAGRAPH', text: 'Écrivez votre leçon ici.' }],
  };
}
