import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HomeScreen } from '../screens/HomeScreen';
import { setupI18n } from '../lib/i18n';
import { db } from '../lib/db';
import { PlayersScreen } from '../screens/PlayersScreen';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

afterEach(() => {
  cleanup();
});

describe('home screen', () => {
  beforeAll(async () => {
    await setupI18n('ar');
    await db.players.clear();
    await db.activeMatch.clear();
    await db.matches.clear();
    await db.teaser.clear();
    await db.settings.clear();
    await db.wordUsage.clear();
  });

  it('shows one mission action and three utility actions', async () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /ابدأ المهمة/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /اللاعبون/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /السجل/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /الإعدادات/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /اللعب ضد الذكاء الاصطناعي/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ابدأ اللعب/i })).not.toBeInTheDocument();
  });

  it('routes history utility button to players screen with focus query', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <LocationProbe />
                <HomeScreen />
              </>
            }
          />
          <Route
            path="/players"
            element={
              <>
                <LocationProbe />
                <PlayersScreen />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const historyButtons = await screen.findAllByRole('button', { name: /السجل/i });
    await user.click(historyButtons[historyButtons.length - 1]);

    const locations = await screen.findAllByTestId('location');
    expect(locations[locations.length - 1]).toHaveTextContent('/players?focus=history');
    expect(await screen.findByRole('heading', { name: /اللاعبون والسجل/i })).toBeInTheDocument();
  });

  it('routes mission button to setup screen when there is no active match', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <LocationProbe />
                <HomeScreen />
              </>
            }
          />
          <Route
            path="/play/setup"
            element={
              <>
                <LocationProbe />
                <p>setup-screen</p>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /ابدأ المهمة/i }));

    const locations = await screen.findAllByTestId('location');
    expect(locations[locations.length - 1]).toHaveTextContent('/play/setup');
    expect(await screen.findByText('setup-screen')).toBeInTheDocument();
  });
});
