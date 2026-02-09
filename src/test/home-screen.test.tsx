import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomeScreen } from '../screens/HomeScreen';
import { setupI18n } from '../lib/i18n';
import { db } from '../lib/db';

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

  it('shows exactly four primary actions', async () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /ابدأ اللعب/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /اللعب ضد الذكاء الاصطناعي/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /اللاعبون والسجل/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /إعدادات اللعبة/i })).toBeInTheDocument();
  });
});
