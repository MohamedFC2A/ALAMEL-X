import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import App from './App';
import { db, defaultSettings } from './lib/db';
import { setupI18n } from './lib/i18n';

const {
  updateGlobalSettingsMock,
  analyzeUiHealthMock,
  collectUiDiagnosticsContextMock,
} = vi.hoisted(() => ({
  updateGlobalSettingsMock: vi.fn(async () => undefined),
  analyzeUiHealthMock: vi.fn(),
  collectUiDiagnosticsContextMock: vi.fn(),
}));

vi.mock('./lib/game-repository', async () => {
  const actual = await vi.importActual<typeof import('./lib/game-repository')>('./lib/game-repository');
  return {
    ...actual,
    updateGlobalSettings: updateGlobalSettingsMock,
  };
});

vi.mock('./lib/ui-self-heal', async () => {
  const actual = await vi.importActual<typeof import('./lib/ui-self-heal')>('./lib/ui-self-heal');
  return {
    ...actual,
    analyzeUiHealth: analyzeUiHealthMock,
    collectUiDiagnosticsContext: collectUiDiagnosticsContextMock,
  };
});

describe('app ui auto-heal runtime', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    updateGlobalSettingsMock.mockClear();
    collectUiDiagnosticsContextMock.mockReturnValue({
      viewportWidth: 340,
      viewportHeight: 640,
      devicePixelRatio: 2,
      rootFontSizePx: 16,
      prefersReducedMotion: false,
      horizontalOverflowPx: 0,
      headerOverflowPx: 0,
      headerTitleTruncated: false,
      actionBarBottomOverlapPx: 0,
      touchTargetRiskCount: 0,
    });
    analyzeUiHealthMock.mockReturnValue({
      report: {
        checkedAt: 1000,
        score: 72,
        context: collectUiDiagnosticsContextMock(),
        issues: [
          {
            code: 'tight-width',
            severity: 'medium',
            weight: 14,
            title: 'عرض ضيق',
            description: 'اختبار',
          },
        ],
      },
      patch: {
        uiScale: 0.94,
      },
    });

    await db.activeMatch.clear();
    await db.settings.clear();
    await db.settings.put({
      ...defaultSettings,
      uiAutoFixEnabled: true,
      uiSelfHealScore: 100,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('debounces resize and dedupes repeated auto-heal writes', async () => {
    vi.useFakeTimers();
    render(<App />);

    for (let i = 0; i < 16; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(220);
      });
      if (updateGlobalSettingsMock.mock.calls.length > 0) {
        break;
      }
      await Promise.resolve();
    }
    expect(updateGlobalSettingsMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));

    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    expect(updateGlobalSettingsMock).toHaveBeenCalledTimes(1);
  });

  it('exposes debug snapshot hook on window', async () => {
    render(<App />);

    await waitFor(() => {
      expect(typeof window.get_ui_debug_snapshot).toBe('function');
    });

    const raw = window.get_ui_debug_snapshot();
    const parsed = JSON.parse(raw) as { route: string; runtimeState: { eventCount: number } };
    expect(parsed.route).toBe('/');
    expect(parsed.runtimeState.eventCount).toBeTypeOf('number');
  });
});
