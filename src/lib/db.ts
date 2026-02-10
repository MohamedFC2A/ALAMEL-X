import Dexie, { type EntityTable } from 'dexie';
import type { ActiveMatch, GlobalSettings, MatchRecord, Player, TeaserOptIn, WordUsage } from '../types';

export interface SusawiDB extends Dexie {
  players: EntityTable<Player, 'id'>;
  settings: EntityTable<GlobalSettings, 'id'>;
  wordUsage: EntityTable<WordUsage, 'wordId'>;
  activeMatch: EntityTable<ActiveMatch, 'id'>;
  matches: EntityTable<MatchRecord, 'id'>;
  teaser: EntityTable<TeaserOptIn, 'id'>;
}

export const defaultSettings: GlobalSettings = {
  id: 'global',
  uiScale: 1,
  animationSpeed: 1,
  reducedMotionMode: false,
  contrastPreset: 'normal',
  uiDensity: 'comfortable',
  soundEnabled: true,
  language: 'ar',
  theme: 'onyx',
  discussionMinutes: 3,
  guessSeconds: 30,
  wordDifficulty: 'any',
  hintMode: 'weak',
  aiEnabled: true,
  aiProvider: 'deepseek',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiModel: 'deepseek-chat',
  aiApiKey: '',
  aiVoiceInputEnabled: true,
  aiVoiceOutputEnabled: true,
};

export const defaultAccessibility = {
  shortSightedMode: false,
  longSightedMode: false,
  extraReadMs: 1000,
  blurReduction: false,
  highContrast: false,
};

const db = new Dexie('susawi-db') as SusawiDB;

db.version(1).stores({
  players: '&id, enabled, updatedAt',
  settings: '&id',
  wordUsage: '&wordId, usedAt, category, matchId',
  activeMatch: '&id',
  matches: '&id, endedAt',
  teaser: '&id',
});

db.version(2).stores({
  players: '&id, enabled, createdAt, updatedAt',
  settings: '&id',
  wordUsage: '&wordId, usedAt, category, matchId',
  activeMatch: '&id',
  matches: '&id, endedAt',
  teaser: '&id',
});

db.version(3).stores({
  players: '&id, enabled, createdAt, updatedAt',
  settings: '&id',
  wordUsage: '&wordId, usedAt, category, matchId',
  activeMatch: '&id',
  matches: '&id, endedAt',
  teaser: '&id',
});

export { db };

export async function ensureSettings(): Promise<GlobalSettings> {
  const current = await db.settings.get('global');
  if (current) {
    const merged: GlobalSettings = {
      ...defaultSettings,
      ...current,
      theme: 'onyx',
      language: 'ar',
      pendingLanguage: undefined,
    };
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      await db.settings.put(merged);
    }
    return merged;
  }

  await db.settings.put(defaultSettings);
  return defaultSettings;
}

export async function ensureTeaser(): Promise<TeaserOptIn> {
  const teaser = await db.teaser.get('ai_teaser');
  if (teaser) {
    return teaser;
  }

  const created: TeaserOptIn = {
    id: 'ai_teaser',
    wantsNotify: false,
    updatedAt: Date.now(),
  };
  await db.teaser.put(created);
  return created;
}
