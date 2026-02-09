import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { ActiveMatch } from '../types';

export function useActiveMatch() {
  return useLiveQuery(async () => {
    const match = await db.activeMatch.get('active');
    return { loaded: true, match: (match ?? null) as ActiveMatch | null };
  }, []);
}
