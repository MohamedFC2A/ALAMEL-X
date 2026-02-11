import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings } from './db';
import {
  __unsafeResetUiDebuggerForTests,
  buildUiDiagnosticsSnapshot,
  clearUiRuntimeEvents,
  getUiRuntimeEvents,
  installUiRuntimeDebugger,
} from './ui-debugger';

function dispatchUnhandledRejection(reason: unknown) {
  const event = new Event('unhandledrejection');
  Object.defineProperty(event, 'reason', {
    configurable: true,
    value: reason,
  });
  window.dispatchEvent(event);
}

describe('ui runtime debugger', () => {
  beforeEach(() => {
    __unsafeResetUiDebuggerForTests();
    clearUiRuntimeEvents();
    window.history.pushState({}, '', '/settings');
  });

  it('captures runtime errors and filters extension noise', () => {
    installUiRuntimeDebugger();

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'boom',
        filename: 'http://localhost/app.js',
        error: new Error('boom'),
      }),
    );
    dispatchUnhandledRejection(new Error('reject boom'));
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'ext-noise',
        filename: 'chrome-extension://abc/content.js',
      }),
    );

    const events = getUiRuntimeEvents();
    expect(events).toHaveLength(2);
    expect(events.some((event) => event.message.includes('boom'))).toBe(true);
    expect(events.some((event) => event.type === 'unhandledrejection')).toBe(true);
    expect(events.some((event) => event.source?.includes('chrome-extension://'))).toBe(false);
  });

  it('builds diagnostics snapshot with runtime state and self-heal data', () => {
    installUiRuntimeDebugger();

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'snapshot-error',
        filename: 'http://localhost/app.js',
        error: new Error('snapshot-error'),
      }),
    );

    const snapshot = buildUiDiagnosticsSnapshot({
      ...defaultSettings,
      uiAutoFixEnabled: true,
      uiSelfHealScore: 88,
      uiSelfHealLastRunAt: 12345,
    });

    expect(snapshot.runtimeState.eventCount).toBeGreaterThan(0);
    expect(snapshot.runtimeEvents.length).toBeGreaterThan(0);
    expect(snapshot.selfHeal.enabled).toBe(true);
    expect(snapshot.selfHeal.score).toBe(88);
    expect(snapshot.route).toBe('/settings');
    expect(snapshot.report.score).toBeTypeOf('number');
  });
});
