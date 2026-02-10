import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RevealScreen } from './RevealScreen';
import { setupI18n } from '../lib/i18n';
import { db } from '../lib/db';
import type { ActiveMatch, Player } from '../types';

afterEach(() => {
  cleanup();
});

const seededPlayers: Player[] = [
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
  {
    id: 'p4',
    name: 'لاعب ٤',
    avatarId: 'girl_2',
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

function buildActiveMatch(playerIds = seededPlayers.map((player) => player.id)): ActiveMatch {
  return {
    id: 'active',
    match: {
      id: 'm1',
      createdAt: Date.now(),
      playerIds,
      spyIds: ['p2'],
      wordId: 'w1',
      category: 'أماكن',
      status: 'reveal',
    },
    revealState: {
      matchId: 'm1',
      currentRevealIndex: 0,
      revealedPlayerIds: [],
      canBack: true,
      phase: 'reveal',
    },
    uiPhaseLabel: 'reveal',
    transitionLock: false,
    resolutionStage: 'vote',
    votedSpyIds: [],
    spyGuess: '',
    spyGuessCorrect: false,
    spyGuessOptionsEn: ['Golden Harbor', 'Silent Harbor', 'Pocket Compass', 'Royal Camera', 'Hidden Market'],
    spyGuessOptionsAr: ['ميدان عام', 'شارع جانبي', 'حارة شعبية', 'كوبري', 'محطة مترو'],
    wordTextEn: 'Golden Harbor',
    wordTextAr: 'ميدان عام',
    spyHintEn: 'Focus on where people usually gather.',
    spyHintAr: 'ركّز على المكان الذي يتجمع فيه الناس.',
    decoysEn: ['Silent Harbor', 'Port Watch', 'Hidden Market'],
    decoysAr: ['شارع جانبي', 'موقف ميكروباص', 'محطة مترو'],
  };
}

describe('reveal screen hold behavior', () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    await db.players.clear();
    await db.activeMatch.clear();
    await db.players.bulkPut(seededPlayers);
    await db.activeMatch.put(buildActiveMatch());
  });

  it('requires sufficient hold progress, then keeps reveal open and unlocks next button', async () => {
    render(
      <MemoryRouter>
        <RevealScreen />
      </MemoryRouter>,
    );

    const nextButton = await screen.findByRole('button', { name: /التالي/i });
    expect(nextButton).toBeDisabled();

    let holdMask = await screen.findByRole('button', { name: /اضغط مطولًا للكشف/i });
    fireEvent.pointerDown(holdMask, { pointerId: 1 });
    await sleep(140);
    fireEvent.pointerUp(holdMask, { pointerId: 1 });

    expect(await screen.findByRole('button', { name: /اضغط مطولًا للكشف/i })).toBeInTheDocument();
    expect(nextButton).toBeDisabled();

    holdMask = screen.getByRole('button', { name: /اضغط مطولًا للكشف/i });
    fireEvent.pointerDown(holdMask, { pointerId: 2 });
    await sleep(380);
    fireEvent.pointerUp(holdMask, { pointerId: 2 });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /اضغط مطولًا للكشف/i })).not.toBeInTheDocument();
    });

    expect(nextButton).toBeDisabled();

    await sleep(1400);
    await waitFor(() => {
      expect(nextButton).toBeEnabled();
    });

    expect(nextButton).toBeEnabled();

    await sleep(250);
    expect(screen.queryByRole('button', { name: /اضغط مطولًا للكشف/i })).not.toBeInTheDocument();
  }, 10000);

  it('auto-skips AI players without revealing secrets', async () => {
    const aiPlayers: Player[] = [
      { ...seededPlayers[0], name: 'العميل صقر', avatarId: 'ai_bot', kind: 'ai' },
      ...seededPlayers.slice(1),
    ];

    await db.players.clear();
    await db.activeMatch.clear();
    await db.players.bulkPut(aiPlayers);
    await db.activeMatch.put(buildActiveMatch(aiPlayers.map((player) => player.id)));

    render(
      <MemoryRouter>
        <RevealScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/جارٍ تجهيز العميل/i)).toBeInTheDocument();

    await sleep(1100);

    await waitFor(() => {
      expect(screen.queryByText(/جارٍ تجهيز العميل/i)).not.toBeInTheDocument();
    });

    expect(await screen.findByRole('heading', { name: /سلّم الموبايل إلى لاعب ٢/i })).toBeInTheDocument();
    expect(screen.queryByText(/الكلمة السرية/i)).not.toBeInTheDocument();
  }, 10000);
});
