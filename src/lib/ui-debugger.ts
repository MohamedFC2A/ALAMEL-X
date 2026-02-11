import type { GlobalSettings } from '../types';
import { analyzeUiHealth, collectUiDiagnosticsContext, type UiSelfHealReport } from './ui-self-heal';

export type UiRuntimeEventType = 'error' | 'unhandledrejection';

export interface UiRuntimeEvent {
  id: string;
  at: number;
  type: UiRuntimeEventType;
  route: string;
  message: string;
  source?: string;
  stack?: string;
}

export interface UiDebuggerState {
  eventCount: number;
  hasErrors: boolean;
  lastEventAt?: number;
}

export interface UiDiagnosticsSnapshot {
  at: number;
  route: string;
  report: UiSelfHealReport;
  selfHeal: {
    enabled: boolean;
    score?: number;
    lastRunAt?: number;
  };
  runtimeState: UiDebuggerState;
  runtimeEvents: UiRuntimeEvent[];
}

const DEFAULT_MAX_EVENTS = 50;
const runtimeEvents: UiRuntimeEvent[] = [];
let runtimeInstalled = false;

function stringifyReason(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return `${value.message}\n${value.stack ?? ''}`.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isExternalExtensionNoise(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('chrome-extension://') || lower.includes('moz-extension://');
}

function pushEvent(event: Omit<UiRuntimeEvent, 'id'>, maxEntries: number) {
  const id = `${event.type}:${event.at}:${runtimeEvents.length + 1}`;
  runtimeEvents.push({ ...event, id });

  const overflow = runtimeEvents.length - Math.max(1, maxEntries);
  if (overflow > 0) {
    runtimeEvents.splice(0, overflow);
  }
}

export function getUiRuntimeEvents(): UiRuntimeEvent[] {
  return [...runtimeEvents];
}

export function clearUiRuntimeEvents(): void {
  runtimeEvents.length = 0;
}

export function getUiDebuggerState(): UiDebuggerState {
  const last = runtimeEvents[runtimeEvents.length - 1];
  return {
    eventCount: runtimeEvents.length,
    hasErrors: runtimeEvents.length > 0,
    lastEventAt: last?.at,
  };
}

export function installUiRuntimeDebugger(maxEntries = DEFAULT_MAX_EVENTS): void {
  if (runtimeInstalled || typeof window === 'undefined') {
    return;
  }

  const effectiveMax = Math.max(1, Math.min(200, Math.round(maxEntries)));
  runtimeInstalled = true;

  window.addEventListener(
    'error',
    (event) => {
      const filename = event.filename || '';
      const message = event.message || '';
      const stack = stringifyReason(event.error);
      const payload = `${filename}\n${message}\n${stack}`.trim();
      if (isExternalExtensionNoise(payload)) {
        return;
      }

      pushEvent(
        {
          at: Date.now(),
          type: 'error',
          route: window.location.pathname,
          message: message || 'Unknown runtime error',
          source: filename || undefined,
          stack: stack || undefined,
        },
        effectiveMax,
      );
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = stringifyReason(event.reason);
      if (isExternalExtensionNoise(reason)) {
        return;
      }

      pushEvent(
        {
          at: Date.now(),
          type: 'unhandledrejection',
          route: window.location.pathname,
          message: reason || 'Unhandled promise rejection',
        },
        effectiveMax,
      );
    },
    true,
  );
}

export function buildUiDiagnosticsSnapshot(settings: GlobalSettings): UiDiagnosticsSnapshot {
  const context = collectUiDiagnosticsContext();
  const { report } = analyzeUiHealth(settings, context);
  return {
    at: Date.now(),
    route: typeof window === 'undefined' ? '/' : window.location.pathname,
    report,
    selfHeal: {
      enabled: settings.uiAutoFixEnabled,
      score: settings.uiSelfHealScore,
      lastRunAt: settings.uiSelfHealLastRunAt,
    },
    runtimeState: getUiDebuggerState(),
    runtimeEvents: getUiRuntimeEvents(),
  };
}

export function serializeUiDiagnosticsSnapshot(settings: GlobalSettings): string {
  return JSON.stringify(buildUiDiagnosticsSnapshot(settings));
}

export function __unsafeResetUiDebuggerForTests() {
  runtimeEvents.length = 0;
  runtimeInstalled = false;
}
