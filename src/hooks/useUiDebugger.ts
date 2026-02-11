import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GlobalSettings } from '../types';
import {
  buildUiDiagnosticsSnapshot,
  clearUiRuntimeEvents,
  getUiDebuggerState,
  getUiRuntimeEvents,
  type UiDiagnosticsSnapshot,
  type UiRuntimeEvent,
} from '../lib/ui-debugger';

type CopyStatus = 'idle' | 'success' | 'error';

export interface UseUiDebuggerResult {
  snapshot: UiDiagnosticsSnapshot | null;
  events: UiRuntimeEvent[];
  eventCount: number;
  copyStatus: CopyStatus;
  runDiagnostics: () => UiDiagnosticsSnapshot | null;
  copySnapshot: () => Promise<boolean>;
  clearRuntimeErrors: () => void;
}

const REFRESH_INTERVAL_MS = 1200;

export function useUiDebugger(settings: GlobalSettings | undefined): UseUiDebuggerResult {
  const [snapshot, setSnapshot] = useState<UiDiagnosticsSnapshot | null>(null);
  const [events, setEvents] = useState<UiRuntimeEvent[]>(() => getUiRuntimeEvents());
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  const refreshEvents = useCallback(() => {
    setEvents(getUiRuntimeEvents());
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(refreshEvents, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshEvents]);

  const runDiagnostics = useCallback(() => {
    if (!settings) {
      return null;
    }
    const next = buildUiDiagnosticsSnapshot(settings);
    setSnapshot(next);
    setEvents(next.runtimeEvents);
    return next;
  }, [settings]);

  const copySnapshot = useCallback(async () => {
    const target = snapshot ?? runDiagnostics();
    if (!target) {
      setCopyStatus('error');
      return false;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('error');
      return false;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(target, null, 2));
      setCopyStatus('success');
      return true;
    } catch {
      setCopyStatus('error');
      return false;
    }
  }, [runDiagnostics, snapshot]);

  const clearRuntimeErrors = useCallback(() => {
    clearUiRuntimeEvents();
    setEvents([]);
    setCopyStatus('idle');
  }, []);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopyStatus('idle');
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const eventCount = useMemo(() => events.length || getUiDebuggerState().eventCount, [events.length]);

  return {
    snapshot,
    events,
    eventCount,
    copyStatus,
    runDiagnostics,
    copySnapshot,
    clearRuntimeErrors,
  };
}
