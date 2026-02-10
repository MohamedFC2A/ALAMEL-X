import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import type { ActiveMatch, Player } from '../types';
import { DiscussionScreen } from './DiscussionScreen';

const orchestratorHookMock = vi.hoisted(() => vi.fn());
const toggleRuntimeMock = vi.hoisted(() => vi.fn());
const clearErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useAiDiscussionOrchestrator', () => ({
  useAiDiscussionOrchestrator: orchestratorHookMock,
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
    name: 'محمد',
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

function buildActiveMatch(overrides?: Partial<ActiveMatch>): ActiveMatch {
  const base: ActiveMatch = {
    id: 'active',
    match: {
      id: 'm1',
      createdAt: Date.now(),
      playerIds: seededPlayers.map((player) => player.id),
      spyIds: ['p2'],
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
    ai: {
      playerIds: ['ai1'],
      threads: {
        ai1: { messages: [], summary: '' },
      },
    },
    discussionEndsAt: Date.now() + 120_000,
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
  return { ...base, ...overrides };
}

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.settings.put({
    ...defaultSettings,
    aiEnabled: true,
    aiAutoFacilitatorEnabled: true,
  });
}

afterEach(() => {
  cleanup();
});

describe('discussion screen AI orchestrator UI', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    toggleRuntimeMock.mockReset();
    clearErrorMock.mockReset();
    orchestratorHookMock.mockReset();
    orchestratorHookMock.mockReturnValue({
      state: {
        status: 'waiting_answer',
        activeAiId: 'ai1',
        activeAiName: 'العميل صقر',
        pendingTargetPlayerId: 'p2',
        pendingTargetName: 'محمد',
        lastSpeakerName: 'محمد',
        lastTranscript: 'هل ده شيء يؤكل',
        lastIntervention: 'العميل صقر: محمد، هل ده شيء يؤكل؟',
        silenceMs: 6200,
        isListening: true,
        isSpeaking: false,
        runtimeEnabled: true,
        updatedAt: Date.now(),
      },
      error: '',
      runtimeEnabled: true,
      toggleRuntimeEnabled: toggleRuntimeMock,
      clearError: clearErrorMock,
    });

    await resetState();
    await db.players.bulkPut(seededPlayers);
    await db.activeMatch.put(buildActiveMatch());
  });

  it('renders orchestrator strip and monitor modal controls', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscussionScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/مستني رد من محمد/i)).toBeInTheDocument();
    expect(screen.getByText(/الصمت الحالي/i)).toBeInTheDocument();

    const openAiButton = screen.getByRole('button', { name: /AI/i });
    await user.click(openAiButton);

    expect(await screen.findByText(/مراقبة AI التلقائي/i)).toBeInTheDocument();
    expect(screen.getByText(/آخر كلام مسموع/i)).toBeInTheDocument();

    const pauseButton = screen.getByRole('button', { name: /إيقاف مؤقت/i });
    await user.click(pauseButton);
    expect(toggleRuntimeMock).toHaveBeenCalledTimes(1);
  });
});
