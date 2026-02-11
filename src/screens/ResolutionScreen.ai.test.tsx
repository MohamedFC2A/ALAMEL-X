import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import type { ActiveMatch, Player } from '../types';
import { ResolutionScreen } from './ResolutionScreen';

const decideVoteDetailedMock = vi.hoisted(() => vi.fn());
const decideGuessMock = vi.hoisted(() => vi.fn());
const speakWithElevenMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/ai/agent', () => ({
  decideVoteDetailed: decideVoteDetailedMock,
  decideGuess: decideGuessMock,
  runtimeConfigFromSettings: (settings: { aiBaseUrl: string; aiModel: string }) => ({
    baseUrl: settings.aiBaseUrl,
    model: settings.aiModel,
  }),
}));

vi.mock('../lib/ai/eleven-client', () => ({
  speakWithEleven: speakWithElevenMock,
}));

const seededPlayers: Player[] = [
  {
    id: 'ai1',
    name: 'العميل صقر',
    avatarId: 'ai_bot',
    kind: 'ai',
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
  {
    id: 'p2',
    name: 'لاعب ٢',
    avatarId: 'girl_1',
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
  {
    id: 'p3',
    name: 'لاعب ٣',
    avatarId: 'boy_2',
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

function buildActiveMatch(overrides?: Partial<ActiveMatch>): ActiveMatch {
  const base: ActiveMatch = {
    id: 'active',
    match: {
      id: 'm1',
      createdAt: Date.now(),
      playerIds: seededPlayers.map((player) => player.id),
      spyIds: ['p3'],
      wordId: 'w1',
      category: 'أماكن',
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
    resolutionStage: 'vote',
    ai: {
      playerIds: ['ai1'],
      mode: 'full',
      threads: {
        ai1: { messages: [], summary: '' },
      },
    },
    votedSpyIds: [],
    voteState: {
      phase: 'handoff',
      voterIndex: 0,
      ballots: {},
      round: 1,
    },
    spyGuess: '',
    spyGuessCorrect: false,
    spyGuessOptionsEn: ['Golden Harbor', 'Silent Harbor', 'Pocket Compass', 'Royal Camera', 'Hidden Market'],
    spyGuessOptionsAr: ['ميدان عام', 'شارع جانبي', 'حارة شعبية', 'كوبري', 'محطة مترو'],
    wordTextEn: 'Golden Harbor',
    wordTextAr: 'ميدان عام',
    spyHintEn: 'hint',
    spyHintAr: 'تلميح',
    decoysEn: ['Silent Harbor', 'Port Watch', 'Hidden Market'],
    decoysAr: ['شارع جانبي', 'موقف ميكروباص', 'محطة مترو'],
  };

  return { ...base, ...overrides };
}

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.settings.put({ ...defaultSettings, aiEnabled: true });
}

afterEach(() => {
  cleanup();
});

describe('resolution screen AI automation', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    decideVoteDetailedMock.mockReset();
    decideGuessMock.mockReset();
    speakWithElevenMock.mockReset();
    speakWithElevenMock.mockResolvedValue(undefined);
    await resetState();
    await db.players.bulkPut(seededPlayers);
  });

  it('auto-casts a ballot when the voter is an AI player', async () => {
    decideVoteDetailedMock.mockResolvedValueOnce({ choice: 'p2', reason: 'أنا شاكك في لاعب ٢ لأن كلامه ملخبط.' });
    await db.activeMatch.put(buildActiveMatch());

    render(
      <MemoryRouter>
        <ResolutionScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /تصويت يدوي بدل ai/i })).not.toBeInTheDocument();

    await waitFor(async () => {
      const updated = await db.activeMatch.get('active');
      expect(updated?.voteState?.voterIndex).toBe(1);
      expect(updated?.voteState?.ballots).toMatchObject({ ai1: 'p2' });
    });

    expect(decideVoteDetailedMock).toHaveBeenCalledTimes(1);
    expect(speakWithElevenMock).toHaveBeenCalledTimes(1);
  });

  it('auto-submits a guess when the captured spy is an AI player', async () => {
    decideGuessMock.mockResolvedValueOnce('محطة مترو');

    await db.activeMatch.put(
      buildActiveMatch({
        resolutionStage: 'guess',
        votedSpyIds: ['ai1'],
        match: {
          ...buildActiveMatch().match,
          spyIds: ['ai1'],
        },
        guessEndsAt: Date.now() + 20_000,
      }),
    );

    render(
      <MemoryRouter>
        <ResolutionScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /تخمين يدوي بدل ai/i })).not.toBeInTheDocument();

    await waitFor(async () => {
      const updated = await db.activeMatch.get('active');
      expect(updated?.resolutionStage).toBe('result');
      expect(updated?.spyGuess).toBe('محطة مترو');
    });

    expect(decideGuessMock).toHaveBeenCalledTimes(1);
  });
});
