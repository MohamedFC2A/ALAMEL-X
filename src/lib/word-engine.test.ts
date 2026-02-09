import { describe, expect, it } from 'vitest';
import { chooseBalancedWord } from './word-engine';
import type { WordEntry } from '../types';

const words: WordEntry[] = [
  {
    id: 'w1',
    text_en: 'Golden Harbor',
    text_ar: 'مكان 1',
    category: 'Places',
    difficulty: 'easy',
    hints: ['place'],
    decoys: [],
  },
  {
    id: 'w2',
    text_en: 'Silent Harbor',
    text_ar: 'مكان 2',
    category: 'Places',
    difficulty: 'easy',
    hints: ['place'],
    decoys: [],
  },
  {
    id: 'w3',
    text_en: 'Pocket Compass',
    text_ar: 'شيء 1',
    category: 'Objects',
    difficulty: 'medium',
    hints: ['object'],
    decoys: [],
  },
  {
    id: 'w4',
    text_en: 'Royal Camera',
    text_ar: 'شيء 2',
    category: 'Objects',
    difficulty: 'medium',
    hints: ['object'],
    decoys: [],
  },
];

describe('word selection', () => {
  it('never selects used words', () => {
    const pick = chooseBalancedWord(words, [{ wordId: 'w1', category: 'Places' }]);
    expect(pick.word.id).not.toBe('w1');
  });

  it('throws when all words are exhausted', () => {
    expect(() =>
      chooseBalancedWord(words, [
        { wordId: 'w1', category: 'Places' },
        { wordId: 'w2', category: 'Places' },
        { wordId: 'w3', category: 'Objects' },
        { wordId: 'w4', category: 'Objects' },
      ]),
    ).toThrow('WORD_EXHAUSTED');
  });

  it('prefers category with least historical usage', () => {
    const usage = [
      { wordId: 'w1', category: 'Places' },
      { wordId: 'w2', category: 'Places' },
    ];
    const pick = chooseBalancedWord(words, usage);
    expect(pick.word.category).toBe('Objects');
  });

  it('returns same-category decoys excluding chosen word', () => {
    const pick = chooseBalancedWord(words, []);
    for (const decoy of pick.decoys) {
      expect(decoy.category).toBe(pick.word.category);
      expect(decoy.id).not.toBe(pick.word.id);
    }
    if (pick.extraDecoy) {
      expect(pick.extraDecoy.category).not.toBe(pick.word.category);
    }
  });
});
