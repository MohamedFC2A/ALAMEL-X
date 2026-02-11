import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import { LoadingProvider } from '../components/loading-controller';
import { PlayersScreen } from '../screens/PlayersScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

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

describe('rtl ui regressions', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    await resetState();
  });

  it('renders players counters as labeled badges and uses game buttons for main actions', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PlayersScreen />
      </MemoryRouter>,
    );

    const addPlayer = await screen.findByRole('button', { name: /^إضافة لاعب$/i });
    const quickAdd = await screen.findByRole('button', { name: /إضافة ٤ لاعبين بسرعة/i });
    expect(addPlayer).toHaveClass('game-button');
    expect(quickAdd).toHaveClass('game-button');

    expect(screen.getByText('0 لاعب')).toBeInTheDocument();
    expect(screen.getByText('0 سجل')).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();

    await user.click(addPlayer);
    expect(await screen.findByRole('button', { name: /إلغاء/i })).toHaveClass('game-button');
    expect(await screen.findByRole('button', { name: /حفظ/i })).toHaveClass('game-button');
  });

  it('uses stacked section headings in settings and shows theme lock hint once', async () => {
    render(
      <LoadingProvider>
        <MemoryRouter>
          <SettingsScreen />
        </MemoryRouter>
      </LoadingProvider>,
    );

    const gameplayHeading = await screen.findByRole('heading', { name: /إعدادات اللعب/i, level: 2 });
    const displayHeading = await screen.findByRole('heading', { name: /إعدادات العرض/i, level: 2 });

    expect(gameplayHeading.closest('.section-heading')).toHaveClass('section-heading--stack');
    expect(displayHeading.closest('.section-heading')).toHaveClass('section-heading--stack');
    expect(screen.getAllByText(/سمة OLED Noir مفعلة دائمًا/i)).toHaveLength(1);
  });
});
