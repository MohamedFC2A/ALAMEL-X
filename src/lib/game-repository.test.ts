import { describe, expect, it } from 'vitest';
import { assignSpies, buildGuessOptions, computeSpyGuessCorrect, resolveWinner } from './game-repository';
import type { ActiveMatch } from '../types';
import { formatWordForDisplay, normalizeWord } from './word-format';

describe('game-repository logic', () => {
  it('assigns exactly one spy when spyCount is 1', () => {
    const spies = assignSpies(['a', 'b', 'c', 'd'], 1);
    expect(spies).toHaveLength(1);
    expect(['a', 'b', 'c', 'd']).toContain(spies[0]);
  });

  it('assigns two unique spies when spyCount is 2', () => {
    const spies = assignSpies(['a', 'b', 'c', 'd', 'e'], 2);
    expect(spies).toHaveLength(2);
    expect(new Set(spies).size).toBe(2);
  });

  it('resolves winner matrix correctly', () => {
    // Vote missed → spies always win
    expect(resolveWinner(false, false)).toBe('spies');
    expect(resolveWinner(false, true)).toBe('spies');
    // Vote captured + guess wrong → citizens win
    expect(resolveWinner(true, false)).toBe('citizens');
    // Vote captured + guess correct → spies steal the round
    expect(resolveWinner(true, true)).toBe('spies');
  });

  it('citizens win when spies are captured and guess times out', () => {
    // Guess timeout is equivalent to spyGuessCorrect = false
    expect(resolveWinner(true, false)).toBe('citizens');
  });

  it('validates spy guess case-insensitively and accepts core word', () => {
    const activeMatch = {
      id: 'active',
      match: {
        id: 'm1',
        createdAt: Date.now(),
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        spyIds: ['p2'],
        wordId: 'w1',
        category: 'Places',
        status: 'resolution',
      },
      revealState: {
        matchId: 'm1',
        currentRevealIndex: 0,
        revealedPlayerIds: [],
        canBack: false,
        phase: 'handoff',
      },
      uiPhaseLabel: 'resolution',
      transitionLock: false,
      resolutionStage: 'guess',
      votedSpyIds: ['p2'],
      spyGuess: '',
      spyGuessCorrect: false,
      spyGuessOptionsEn: ['Golden Harbor', 'Silent Harbor', 'Pocket Compass', 'Royal Camera', 'Hidden Market'],
      spyGuessOptionsAr: ['مكان 1', 'مكان 2', 'شيء 1', 'شيء 2', 'سوق خفي'],
      wordTextEn: 'Golden Harbor',
      wordTextAr: 'مكان 1',
      spyHintEn: 'hint',
      spyHintAr: 'تلميح',
      decoysEn: ['A', 'B', 'C'],
      decoysAr: ['أ', 'ب', 'ج'],
    } satisfies ActiveMatch;

    expect(computeSpyGuessCorrect(activeMatch, 'golden harbor')).toBe(true);
    expect(computeSpyGuessCorrect(activeMatch, 'harbor')).toBe(true);
    expect(computeSpyGuessCorrect(activeMatch, 'wrong')).toBe(false);
  });

  it('always keeps the correct word inside spy guess options', () => {
    const options = buildGuessOptions(
      'ar',
      'ميدان عام',
      ['شارع جانبي', 'حارة شعبية', 'موقف ميكروباص'],
      ['كوبري', 'جامعة'],
      'ملعب',
      ['شارع جانبي', 'حارة شعبية', 'موقف ميكروباص', 'محطة مترو', 'كوبري', 'جامعة'],
      ['طعمية', 'فول', 'كشري', 'شاي'],
    );

    expect(options).toContain('ميدان عام');
    expect(options).toHaveLength(5);
    expect(new Set(options).size).toBe(options.length);
  });

  it('never drops the correct option even with repeated shuffles', () => {
    const expected = normalizeWord(formatWordForDisplay('Golden Harbor', 'en'));
    for (let i = 0; i < 120; i += 1) {
      const options = buildGuessOptions(
        'en',
        'Golden Harbor',
        ['Silent Harbor', 'Harbor Street', 'Dock Gate'],
        ['Port Watch', 'Harbor Light'],
        'Sea Route',
        ['Silent Harbor', 'Harbor Street', 'Dock Gate', 'Port Watch', 'Harbor Light'],
        ['Pocket Compass', 'Royal Camera', 'Hidden Market'],
      );
      expect(options.some((option) => normalizeWord(option) === expected)).toBe(true);
      expect(new Set(options).size).toBe(options.length);
    }
  });
});
