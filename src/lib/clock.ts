type ClockListener = (now: number) => void;

let timeOffset = 0;
const listeners = new Set<ClockListener>();

export function nowMs(): number {
  return Date.now() + timeOffset;
}

export function subscribeClock(listener: ClockListener): () => void {
  listeners.add(listener);
  listener(nowMs());
  return () => listeners.delete(listener);
}

function broadcast(): void {
  const current = nowMs();
  listeners.forEach((listener) => listener(current));
}

export function advanceClock(ms: number): void {
  timeOffset += ms;
  broadcast();
}

export function tickClock(): void {
  broadcast();
}

export function installClockDebugHooks(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.advanceTime = (ms: number) => {
    advanceClock(ms);
  };
}

declare global {
  interface Window {
    advanceTime: (ms: number) => void;
  }
}
