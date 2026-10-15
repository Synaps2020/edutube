import { describe, it, expect } from 'vitest';
import { returnPath } from './auth-context';
describe('Retour après connexion', () => {
  it('conserve la destination interne', () => {
    expect(returnPath('/apprendre/thales/thales-2')).toBe('/apprendre/thales/thales-2');
  });
  it('refuse les adresses externes et les caractères trompeurs', () => {
    for (const value of [
      null,
      'https://autre.test',
      '//autre.test',
      '/\\autre.test',
      '/connexion',
      '/\n/autre.test',
    ]) {
      expect(returnPath(value)).toBe('/mon-espace');
    }
  });
});
