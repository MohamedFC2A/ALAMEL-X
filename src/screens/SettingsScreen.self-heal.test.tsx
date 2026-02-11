import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { defaultSettings, db } from '../lib/db';
import { setupI18n } from '../lib/i18n';
import { LoadingProvider } from '../components/loading-controller';
import { clearUiRuntimeEvents, installUiRuntimeDebugger } from '../lib/ui-debugger';
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
    installUiRuntimeDebugger();
  });

  beforeEach(async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 340 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    clearUiRuntimeEvents();
    await resetState();
  });

  it('runs self-heal and persists compact display patch on small viewports', async () => {
    const user = userEvent.setup();
    render(
      <LoadingProvider>
        <MemoryRouter>
          <SettingsScreen />
        </MemoryRouter>
      </LoadingProvider>,
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

  it('supports diagnostics copy and clear runtime error actions', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    render(
      <LoadingProvider>
        <MemoryRouter>
          <SettingsScreen />
        </MemoryRouter>
      </LoadingProvider>,
    );

    const runDiagnosticsButton = await screen.findByRole('button', { name: /تشغيل تشخيص/i });
    await user.click(runDiagnosticsButton);
    await screen.findByText(/وقت التشخيص/i);

    const copyButton = await screen.findByRole('button', { name: /نسخ تقرير json/i });
    await user.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/تم نسخ التقرير/i)).toBeInTheDocument();
    });

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'panel-runtime-error',
        filename: 'http://localhost/runtime.js',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/panel-runtime-error/i)).toBeInTheDocument();
    });

    const clearButton = await screen.findByRole('button', { name: /مسح سجل الأخطاء/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText(/لا توجد أخطاء runtime مسجلة/i)).toBeInTheDocument();
    });
  });

  it('shows fallback banner when copy snapshot fails', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn(async () => {
      throw new Error('copy-fail');
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    render(
      <LoadingProvider>
        <MemoryRouter>
          <SettingsScreen />
        </MemoryRouter>
      </LoadingProvider>,
    );

    const runDiagnosticsButton = await screen.findByRole('button', { name: /تشغيل تشخيص/i });
    await user.click(runDiagnosticsButton);
    await screen.findByText(/وقت التشخيص/i);

    const copyButton = await screen.findByRole('button', { name: /نسخ تقرير json/i });
    await user.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/تعذّر نسخ التقرير/i)).toBeInTheDocument();
    });
  });
});
