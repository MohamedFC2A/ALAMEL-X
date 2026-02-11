import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ActiveMatch, MatchStatus, Player } from '../types';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import { DiscussionScreen } from './DiscussionScreen';
import { ResolutionScreen } from './ResolutionScreen';

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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function buildActiveMatch(status: MatchStatus): ActiveMatch {
  return {
    id: 'active',
    match: {
      id: 'm_restart',
      createdAt: Date.now(),
      playerIds: players.map((player) => player.id),
      spyIds: ['p2'],
      wordId: 'w1',
      category: 'أماكن',
      status,
    },
    revealState: {
      matchId: 'm_restart',
      currentRevealIndex: 0,
      revealedPlayerIds: [],
      canBack: false,
      phase: 'handoff',
    },
    uiPhaseLabel: status === 'resolution' ? 'resolution' : 'discussion',
    transitionLock: false,
    resolutionStage: 'vote',
    votedSpyIds: [],
    voteState: {
      phase: 'handoff',
      voterIndex: 0,
      ballots: {},
      round: 1,
    },
    discussionEndsAt: Date.now() + 30_000,
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
  vi.restoreAllMocks();
});

describe('restart round flow', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    await resetState();
    await db.players.bulkPut(players);
  });

  it('abandons active match from discussion screen and navigates to setup', async () => {
    await db.activeMatch.put(buildActiveMatch('discussion'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/play/discussion']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <LocationProbe />
                <div>home</div>
              </>
            }
          />
          <Route
            path="/play/discussion"
            element={
              <>
                <LocationProbe />
                <DiscussionScreen />
              </>
            }
          />
          <Route
            path="/play/setup"
            element={
              <>
                <LocationProbe />
                <div>setup</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /إعادة اللعب/i }));

    await waitFor(async () => {
      const active = await db.activeMatch.get('active');
      expect(active).toBeUndefined();
    });
    expect((await screen.findAllByTestId('location')).at(-1)).toHaveTextContent('/play/setup');
  });

  it('abandons active match from resolution screen and navigates to setup', async () => {
    await db.activeMatch.put(buildActiveMatch('resolution'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/play/resolution']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <LocationProbe />
                <div>home</div>
              </>
            }
          />
          <Route
            path="/play/resolution"
            element={
              <>
                <LocationProbe />
                <ResolutionScreen />
              </>
            }
          />
          <Route
            path="/play/setup"
            element={
              <>
                <LocationProbe />
                <div>setup</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /إعادة اللعب/i }));

    await waitFor(async () => {
      const active = await db.activeMatch.get('active');
      expect(active).toBeUndefined();
    });
    expect((await screen.findAllByTestId('location')).at(-1)).toHaveTextContent('/play/setup');
  });
});
