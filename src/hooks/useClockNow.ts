import { useEffect, useState } from 'react';
import { nowMs, subscribeClock } from '../lib/clock';

export function useClockNow(refreshIntervalMs = 250): number {
  const [now, setNow] = useState<number>(() => nowMs());

  useEffect(() => {
    const unsubscribe = subscribeClock(setNow);
    const interval = window.setInterval(() => {
      setNow(nowMs());
    }, refreshIntervalMs);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return now;
}
