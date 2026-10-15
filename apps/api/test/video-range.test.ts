import { describe, it, expect } from 'vitest';
import { videoRange } from '../src/domain/video-range';
describe('Lecture partielle des vidéos', () => {
  it('sert la plage demandée sans lire tout le fichier', () => {
    expect(videoRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199, length: 100 });
  });
  it('accepte une fin ouverte et un suffixe', () => {
    expect(videoRange('bytes=900-', 1000)?.length).toBe(100);
    expect(videoRange('bytes=-20', 1000)).toEqual({ start: 980, end: 999, length: 20 });
  });
  it('refuse les plages inversées, multiples et hors du fichier', () => {
    for (const header of [
      'bytes=9999-',
      'bytes=20-10',
      'bytes=-0',
      'bytes=1-2,4-5',
      'bytes=-',
      'malforme',
    ]) {
      expect(() => videoRange(header, 1000)).toThrow();
    }
  });
});
