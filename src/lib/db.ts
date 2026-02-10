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
  aiHumanMode: 'natural',
  aiReasoningDepth: 2,
  aiReplyLength: 'balanced',
  aiInitiativeLevel: 35,
  aiMemoryDepth: 14,
  aiVoiceInputEnabled: true,
  aiVoiceOutputEnabled: true,
  aiVoiceProvider: 'elevenlabs',
  aiAutoFacilitatorEnabled: true,
  aiSilenceThresholdMs: 6000,
  aiInterventionRestMs: 9000,
  aiHumanSimulationEnabled: false,
  aiAdaptiveStats: {
    matchesPlayed: 0,
    spyRounds: 0,
    citizenRounds: 0,
    spyWins: 0,
    citizenWins: 0,
    successfulSpyGuesses: 0,
    failedSpyGuesses: 0,
    successfulCaptures: 0,
    missedCaptures: 0,
    averageSignalStrength: 0,
    memoryBank: [],
    updatedAt: Date.now(),
  },
};

function normalizeAdaptiveStats(input: GlobalSettings['aiAdaptiveStats'] | undefined): GlobalSettings['aiAdaptiveStats'] {
  const base = defaultSettings.aiAdaptiveStats;
  const merged = {
    ...base,
    ...(input ?? {}),
  };

  return {
    ...merged,
    memoryBank: Array.isArray(merged.memoryBank) ? merged.memoryBank.slice(0, 30) : [],
    updatedAt: Number.isFinite(merged.updatedAt) ? merged.updatedAt : Date.now(),
  };
}

export function normalizeGlobalSettings(input: GlobalSettings): GlobalSettings {
  const normalized: GlobalSettings = {
    ...input,
    id: 'global',
    theme: 'onyx',
    language: 'ar',
    aiVoiceProvider: 'elevenlabs',
    pendingLanguage: undefined,
    aiAdaptiveStats: normalizeAdaptiveStats(input.aiAdaptiveStats),
  };

  normalized.aiHumanSimulationEnabled =
    normalized.aiHumanMode === 'ultra' ? Boolean(normalized.aiHumanSimulationEnabled) : false;

  return normalized;
}

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
    const merged = normalizeGlobalSettings({
      ...defaultSettings,
      ...current,
      aiAdaptiveStats: normalizeAdaptiveStats(current.aiAdaptiveStats),
    });
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      await db.settings.put(merged);
    }
    return merged;
  }

  const normalizedDefault = normalizeGlobalSettings(defaultSettings);
  await db.settings.put(normalizedDefault);
  return normalizedDefault;
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
