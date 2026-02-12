import { describe, expect, it } from 'vitest';
import type { Player, PlayerProgression } from '../types';
import {
  applyRoundProgression,
  createDefaultProgression,
  ensureProgressionState,
  getLevelForXp,
  getNextLevelThreshold,
  medalCatalog,
} from './player-progression';

function buildPlayer(progression?: PlayerProgression): Player {
  return {
    id: 'p1',
    name: 'لاعب',
    avatarId: 'boy_1',
    enabled: true,
    accessibility: {
      shortSightedMode: false,
      longSightedMode: false,
      extraReadMs: 0,
      blurReduction: false,
      highContrast: false,
    },
    stats: {
      gamesPlayed: 0,
      spyWins: 0,
      citizenWins: 0,
    },
    progression,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('player progression engine', () => {
  it('unlocks expected medals and levels up based on weighted XP', () => {
    const now = 1_700_000_000_000;
    const result = applyRoundProgression(buildPlayer(), {
      now,
      role: 'citizen',
      teamWon: true,
      winner: 'citizens',
      spyCount: 1,
      voteOutcome: 'captured',
      spyGuessCorrect: false,
      wasRunoff: false,
    });

    const unlocked = result.newlyUnlockedMedals.map((item) => item.id);
    expect(unlocked).toContain('first_step');
    expect(unlocked).toContain('first_win');
    expect(unlocked).toContain('citizen_debut');

    const progression = ensureProgressionState(result.updatedPlayer.progression);
    expect(progression.xp).toBe(443);
    expect(progression.level).toBe(4);
    expect(result.newLevels).toEqual([2, 3, 4]);
  });

  it('does not grant the same medal twice across rounds', () => {
    const now = 1_700_000_000_000;
    const first = applyRoundProgression(buildPlayer(), {
      now,
      role: 'citizen',
      teamWon: true,
      winner: 'citizens',
      spyCount: 1,
      voteOutcome: 'captured',
      spyGuessCorrect: false,
      wasRunoff: false,
    });

    const second = applyRoundProgression(first.updatedPlayer, {
      now: now + 5_000,
      role: 'citizen',
      teamWon: false,
      winner: 'spies',
      spyCount: 1,
      voteOutcome: 'missed',
      spyGuessCorrect: false,
      wasRunoff: false,
    });

    const firstStepCount = ensureProgressionState(second.updatedPlayer.progression).medals.filter(
      (entry) => entry.medalId === 'first_step',
    ).length;
    expect(firstStepCount).toBe(1);
    expect(second.newlyUnlockedMedals.find((item) => item.id === 'first_step')).toBeUndefined();
  });

  it('unlocks collector medals when unlocked count crosses thresholds', () => {
    const now = 1_700_000_000_000;
    const seededTen = createDefaultProgression(now);
    seededTen.medals = medalCatalog.slice(0, 9).map((medal, index) => ({ medalId: medal.id, unlockedAt: now - (index + 1) * 1000 }));
    seededTen.metrics.comebackWins = 1;

    const first = applyRoundProgression(buildPlayer(seededTen), {
      now,
      role: 'spy',
      teamWon: false,
      winner: 'citizens',
      spyCount: 1,
      voteOutcome: 'captured',
      spyGuessCorrect: false,
      wasRunoff: false,
    });

    const firstUnlocked = first.newlyUnlockedMedals.map((item) => item.id);
    expect(firstUnlocked).toContain('comeback_king');
    expect(firstUnlocked).toContain('collector_i');

    const collectorReady = ensureProgressionState(first.updatedPlayer.progression);
    collectorReady.medals = [
      ...medalCatalog.slice(0, 18).map((medal, index) => ({ medalId: medal.id, unlockedAt: now - (index + 2) * 1500 })),
      { medalId: 'collector_i', unlockedAt: now - 2500 },
    ];
    collectorReady.metrics.duoWinsAny = 3;

    const second = applyRoundProgression(buildPlayer(collectorReady), {
      now: now + 10_000,
      role: 'citizen',
      teamWon: false,
      winner: 'spies',
      spyCount: 2,
      voteOutcome: 'missed',
      spyGuessCorrect: false,
      wasRunoff: false,
    });

    expect(second.newlyUnlockedMedals.map((item) => item.id)).toContain('collector_ii');
  });

  it('continues level growth beyond 20 with dynamic thresholds', () => {
    expect(getLevelForXp(5400)).toBe(20);
    expect(getLevelForXp(5460)).toBe(21);
    expect(getLevelForXp(5544)).toBe(21);
    expect(getLevelForXp(5545)).toBe(22);
    expect(getNextLevelThreshold(20)).toBe(5460);
    expect(getNextLevelThreshold(21)).toBe(5545);
  });
});
