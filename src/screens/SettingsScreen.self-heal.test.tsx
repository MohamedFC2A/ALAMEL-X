import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { defaultSettings, db } from '../lib/db';
import { setupI18n } from '../lib/i18n';
import { SettingsScreen } from './SettingsScreen';

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.settings.put({
    ...defaultSettings,
    aiEnabled: false,
  });
}

afterEach(() => {
  cleanup();
});

describe('settings self-heal flow', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 340 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    await resetState();
  });

  it('runs self-heal and persists compact display patch on small viewports', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    const runButton = await screen.findByRole('button', { name: /تشغيل الإصلاح الذاتي الآن/i });
    await user.click(runButton);

    await waitFor(async () => {
      const settings = await db.settings.get('global');
      expect(settings?.uiDensity).toBe('compact');
      expect((settings?.uiScale ?? 1)).toBeLessThan(1);
      expect(settings?.uiSelfHealLastRunAt).toBeTypeOf('number');
      expect((settings?.uiSelfHealScore ?? 0)).toBeGreaterThan(0);
    });
  });
});
