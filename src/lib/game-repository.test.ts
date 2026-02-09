import { describe, expect, it } from 'vitest';
import { assignSpies, computeSpyGuessCorrect, resolveWinner } from './game-repository';
import type { ActiveMatch } from '../types';

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
    expect(resolveWinner(false, false)).toBe('citizens');
    expect(resolveWinner(true, false)).toBe('citizens');
    expect(resolveWinner(true, true)).toBe('spies');
    expect(resolveWinner(false, true)).toBe('spies');
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
});
