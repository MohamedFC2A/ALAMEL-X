import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import { SettingsScreen } from './SettingsScreen';

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

describe('settings screen AI section', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    await resetState();
  });

  it('persists AI toggles without exposing key input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    const aiEnabled = await screen.findByRole('checkbox', { name: /تفعيل لاعب ai/i });
    expect(aiEnabled).toBeChecked();
    await user.click(aiEnabled);

    await waitFor(async () => {
      const settings = await db.settings.get('global');
      expect(settings?.aiEnabled).toBe(false);
    });

    const voiceOut = await screen.findByRole('checkbox', { name: /نطق ردود ai/i });
    await user.click(voiceOut);

    await waitFor(async () => {
      const settings = await db.settings.get('global');
      expect(settings?.aiVoiceOutputEnabled).toBe(false);
    });

    expect(screen.queryByPlaceholderText(/ضع المفتاح هنا/i)).not.toBeInTheDocument();
    expect(screen.getByText(/مفتاح deepseek غير ظاهر للمستخدم/i)).toBeInTheDocument();
  });
});
