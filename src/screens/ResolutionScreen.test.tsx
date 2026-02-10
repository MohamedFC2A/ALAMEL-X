import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import type { ActiveMatch, Player } from '../types';
import { ResolutionScreen } from './ResolutionScreen';

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

function buildActiveMatch(): ActiveMatch {
  return {
    id: 'active',
    match: {
      id: 'm1',
      createdAt: Date.now(),
      playerIds: seededPlayers.map((player) => player.id),
      spyIds: ['p2'],
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
}

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.settings.put(defaultSettings);
}

afterEach(() => {
  cleanup();
});

describe('resolution screen voting flow', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    await resetState();
    await db.players.bulkPut(seededPlayers);
    await db.activeMatch.put(buildActiveMatch());
  });

  it('captures a spy when the majority vote winner is a spy', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResolutionScreen />
      </MemoryRouter>,
    );

    // Voter 1 -> p2 (spy)
    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    // Voter 2 -> p3
    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٣/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    // Voter 3 -> p2
    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    // Voter 4 -> p2
    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    expect(await screen.findByText(/بعد التصويت، الجاسوس يخمّن الكلمة/i)).toBeInTheDocument();

    const updated = await db.activeMatch.get('active');
    expect(updated?.resolutionStage).toBe('guess');
    expect(updated?.voteOutcome).toBe('captured');
    expect(updated?.votedSpyIds).toEqual(['p2']);
  }, 12_000);

  it('starts a runoff when the first round is tied, then resolves in round 2', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResolutionScreen />
      </MemoryRouter>,
    );

    // Round 1: tie between p2 and p3 (2 votes each)
    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٣/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٣/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    expect(await screen.findByText(/تعادل! إعادة تصويت/i)).toBeInTheDocument();

    const afterTie = await db.activeMatch.get('active');
    expect(afterTie?.voteState?.round).toBe(2);
    expect(afterTie?.voteState?.candidates?.sort()).toEqual(['p2', 'p3']);

    // Round 2: pick p2 as the overall winner
    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٣/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    await user.click(await screen.findByRole('button', { name: /متابعة/i }));
    await user.click(await screen.findByRole('button', { name: /لاعب ٢/i }));
    await user.click(await screen.findByRole('button', { name: /تأكيد التصويت/i }));

    expect(await screen.findByText(/بعد التصويت، الجاسوس يخمّن الكلمة/i)).toBeInTheDocument();

    const updated = await db.activeMatch.get('active');
    expect(updated?.resolutionStage).toBe('guess');
    expect(updated?.voteOutcome).toBe('captured');
    expect(updated?.votedSpyIds).toEqual(['p2']);
  }, 12_000);
});
