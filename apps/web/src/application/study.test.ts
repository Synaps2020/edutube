import { describe, expect, it } from 'vitest';
import { gradeQuiz, emptyStudy } from '../domain/study';
import { toggleFavorite, saveNote } from './study';
import { demoMaterials } from '../adapters/demo-materials';
describe('outils apprenant', () => {
  it('ajoute puis retire un favori sans muter la source', () => {
    const added = toggleFavorite(emptyStudy, 'thales');
    expect(added.favorites).toEqual(['thales']);
    expect(toggleFavorite(added, 'thales').favorites).toEqual([]);
    expect(emptyStudy.favorites).toEqual([]);
  });
  it('conserve les notes des autres chapitres', () => {
    const state = saveNote(saveNote(emptyStudy, 'one', 'Ma note'), 'two', 'Une autre');
    expect(state.notes).toEqual({ one: 'Ma note', two: 'Une autre' });
  });
  it('corrige uniquement les réponses exactes', () => {
    expect(gradeQuiz(demoMaterials.thales.questions, { t1: 0, t2: 0 })).toEqual({
      correct: 1,
      total: 2,
      percent: 50,
    });
    expect(gradeQuiz(demoMaterials.thales.questions, {}).percent).toBe(0);
  });
  it('chaque cours de démonstration a une correction valide', () => {
    Object.values(demoMaterials).forEach((material) => {
      material.questions.forEach((question) =>
        expect(question.options[question.correctIndex]).toBeTruthy(),
      );
    });
  });
});
