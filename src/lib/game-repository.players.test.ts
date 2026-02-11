import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deletePlayer } from './game-repository';
import type { ActiveMatch, Player } from '../types';

function buildPlayer(id: string, name: string): Player {
  return {
    id,
    name,
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
    createdAt: 1,
    updatedAt: 1,
  };
}

function buildActiveMatch(playerIds: string[]): ActiveMatch {
  return {
    id: 'active',
    match: {
      id: 'm1',
      createdAt: Date.now(),
      playerIds,
      spyIds: [playerIds[playerIds.length - 1]],
      wordId: 'w1',
      category: 'أماكن',
      status: 'discussion',
    },
    revealState: {
      matchId: 'm1',
      currentRevealIndex: 0,
      revealedPlayerIds: [],
      canBack: false,
      phase: 'handoff',
    },
    uiPhaseLabel: 'discussion',
    transitionLock: false,
    resolutionStage: 'vote',
    votedSpyIds: [],
    voteState: {
      phase: 'handoff',
      voterIndex: 0,
      ballots: {},
      round: 1,
    },
    spyGuess: '',
    spyGuessCorrect: false,
    spyGuessOptionsEn: [],
    spyGuessOptionsAr: [],
    wordTextEn: 'Golden Harbor',
    wordTextAr: 'ميدان عام',
    spyHintEn: 'hint',
    spyHintAr: 'تلميح',
    decoysEn: [],
    decoysAr: [],
  };
}

describe('player deletion rules', () => {
  beforeEach(async () => {
    await db.players.clear();
    await db.activeMatch.clear();
    await db.matches.clear();
    await db.settings.clear();
    await db.wordUsage.clear();
    await db.teaser.clear();
  });

  it('deletes a player normally when no active match depends on them', async () => {
    await db.players.put(buildPlayer('p1', 'محمد'));

    await deletePlayer('p1');

    const deleted = await db.players.get('p1');
    expect(deleted).toBeUndefined();
  });

  it('blocks deleting players that are inside the active match', async () => {
    await db.players.bulkPut([
      buildPlayer('p1', 'محمد'),
      buildPlayer('p2', 'منى'),
      buildPlayer('p3', 'سارة'),
    ]);
    await db.activeMatch.put(buildActiveMatch(['p1', 'p2', 'p3']));

    await expect(deletePlayer('p1')).rejects.toThrow('PLAYER_IN_ACTIVE_MATCH');

    const stillExists = await db.players.get('p1');
    expect(stillExists?.name).toBe('محمد');
  });
});
