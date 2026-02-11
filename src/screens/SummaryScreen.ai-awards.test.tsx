import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db, defaultSettings } from '../lib/db';
import { setupI18n } from '../lib/i18n';
import type { MatchRecord, Player } from '../types';

const speakWithElevenMock = vi.hoisted(() => vi.fn());
const speakWithBrowserSynthesisMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/ai/eleven-client', () => ({
  speakWithEleven: speakWithElevenMock,
}));

vi.mock('../lib/ai/browser-voice', () => ({
  speakWithBrowserSynthesis: speakWithBrowserSynthesisMock,
}));

import { SummaryScreen } from './SummaryScreen';

const players: Player[] = [
  {
    id: 'p1',
    name: 'لاعب ١',
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
  },
];

function buildRecord(id: string): MatchRecord {
  return {
    id,
    match: {
      id,
      createdAt: Date.now(),
      playerIds: ['p1'],
      spyIds: ['p1'],
      wordId: 'w1',
      category: 'أماكن',
      status: 'completed',
    },
    result: {
      matchId: id,
      votedSpyIds: ['p1'],
      spyGuess: 'ميدان عام',
      spyGuessCorrect: true,
      winner: 'spies',
    },
    endedAt: Date.now(),
    wordTextEn: 'Golden Harbor',
    wordTextAr: 'ميدان عام',
    decoysEn: ['Silent Harbor', 'Port Watch', 'Hidden Market'],
    decoysAr: ['شارع جانبي', 'موقف ميكروباص', 'محطة مترو'],
    roundAwards: [
      {
        playerId: 'p1',
        playerName: 'لاعب ١',
        medalIds: ['first_step', 'first_win'],
        levelUps: [2],
        xpAfter: 270,
        levelAfter: 3,
      },
    ],
  };
}

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.players.bulkPut(players);
  await db.settings.put({
    ...defaultSettings,
    soundEnabled: true,
    aiVoiceOutputEnabled: true,
  });
}

afterEach(() => {
  cleanup();
});

describe('summary awards narration', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    speakWithElevenMock.mockReset();
    speakWithBrowserSynthesisMock.mockReset();
    await resetState();
  });

  it('speaks round awards once with eleven labs when available', async () => {
    speakWithElevenMock.mockResolvedValue(undefined);
    await db.matches.put(buildRecord('match_award_1'));

    render(
      <MemoryRouter>
        <SummaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(speakWithElevenMock).toHaveBeenCalledTimes(1);
    });
    expect(speakWithBrowserSynthesisMock).not.toHaveBeenCalled();
  });

  it('falls back to browser synthesis when eleven labs fails', async () => {
    speakWithElevenMock.mockRejectedValue(new Error('tts failed'));
    speakWithBrowserSynthesisMock.mockResolvedValue(undefined);
    await db.matches.put(buildRecord('match_award_2'));

    render(
      <MemoryRouter>
        <SummaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(speakWithElevenMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(speakWithBrowserSynthesisMock).toHaveBeenCalledTimes(1);
    });
  });
});
