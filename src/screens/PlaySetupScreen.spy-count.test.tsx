import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoadingProvider } from '../components/loading-controller';
import { db, defaultSettings } from '../lib/db';
import { setupI18n } from '../lib/i18n';
import { buildPlayer } from '../lib/game-repository';
import { PlaySetupScreen } from './PlaySetupScreen';

const {
  wordsUsageSummaryMock,
} = vi.hoisted(() => ({
  wordsUsageSummaryMock: vi.fn(async () => ({ used: 0, total: 504 })),
}));

vi.mock('../lib/game-repository', async () => {
  const actual = await vi.importActual<typeof import('../lib/game-repository')>('../lib/game-repository');
  return {
    ...actual,
    wordsUsageSummary: wordsUsageSummaryMock,
    resetWordLocks: vi.fn(async () => undefined),
  };
});

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.settings.put(defaultSettings);
}

describe('play setup spy count controls', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    wordsUsageSummaryMock.mockClear();
    await resetState();

    const players = [
      buildPlayer('أحمد', 'boy_1'),
      buildPlayer('ليلى', 'girl_1'),
      buildPlayer('سامي', 'boy_2'),
      buildPlayer('ندى', 'girl_2'),
    ];
    await db.players.bulkPut(players);
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps spy selector clear and enforces min players for one vs two spies', async () => {
    const user = userEvent.setup();
    render(
      <LoadingProvider>
        <MemoryRouter initialEntries={['/play/setup']}>
          <Routes>
            <Route path="/play/setup" element={<PlaySetupScreen />} />
          </Routes>
        </MemoryRouter>
      </LoadingProvider>,
    );

    const spySelector = await screen.findByRole('group', { name: /عدد الجواسيس/i });
    const oneSpyButton = within(spySelector).getByRole('button', { name: /^1/ });
    const twoSpiesButton = within(spySelector).getByRole('button', { name: /^2/ });
    const startButton = screen.getByRole('button', { name: /ابدأ الجولة/i });

    expect(oneSpyButton).toHaveClass('active');
    expect(startButton).toBeDisabled();

    await user.click(await screen.findByRole('button', { name: /أحمد/i }));
    await user.click(screen.getByRole('button', { name: /ليلى/i }));
    await user.click(screen.getByRole('button', { name: /سامي/i }));

    expect(startButton).toBeEnabled();

    await user.click(twoSpiesButton);
    expect(screen.getByText(/المحدد:\s*2/i)).toBeInTheDocument();
    expect(startButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /ندى/i }));
    expect(startButton).toBeEnabled();
  });
});
