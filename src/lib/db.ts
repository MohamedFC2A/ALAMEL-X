import Dexie, { type EntityTable } from 'dexie';
import type { ActiveMatch, GlobalSettings, MatchRecord, Player, TeaserOptIn, WordUsage } from '../types';

const ALLOWED_THEMES = new Set<GlobalSettings['theme']>(['dreamland', 'aurora', 'solar', 'onyx']);

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
  uiAutoFixEnabled: true,
  uiSelfHealScore: 100,
  uiSelfHealLastRunAt: undefined,
  reducedMotionMode: false,
  contrastPreset: 'normal',
  uiDensity: 'comfortable',
  soundEnabled: true,
  language: 'ar',
  theme: 'dreamland',
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

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Number(value)));
}

export function normalizeGlobalSettings(input: GlobalSettings): GlobalSettings {
  const normalized: GlobalSettings = {
    ...input,
    id: 'global',
    theme: ALLOWED_THEMES.has(input.theme) ? input.theme : defaultSettings.theme,
    language: 'ar',
    aiVoiceProvider: 'elevenlabs',
    pendingLanguage: undefined,
    uiScale: Number(normalizeNumber(input.uiScale, defaultSettings.uiScale, 0.85, 1.2).toFixed(2)),
    animationSpeed: Number(normalizeNumber(input.animationSpeed, defaultSettings.animationSpeed, 0.5, 1.5).toFixed(2)),
    uiAutoFixEnabled: Boolean(input.uiAutoFixEnabled),
    uiSelfHealScore: Number.isFinite(input.uiSelfHealScore)
      ? Math.max(0, Math.min(100, Math.round(input.uiSelfHealScore as number)))
      : undefined,
    uiSelfHealLastRunAt: Number.isFinite(input.uiSelfHealLastRunAt) ? Math.max(0, Number(input.uiSelfHealLastRunAt)) : undefined,
    discussionMinutes: Math.round(normalizeNumber(input.discussionMinutes, defaultSettings.discussionMinutes, 2, 6)),
    guessSeconds: Math.round(normalizeNumber(input.guessSeconds, defaultSettings.guessSeconds, 15, 60)),
    aiInitiativeLevel: Math.round(normalizeNumber(input.aiInitiativeLevel, defaultSettings.aiInitiativeLevel, 0, 100)),
    aiMemoryDepth: Math.round(normalizeNumber(input.aiMemoryDepth, defaultSettings.aiMemoryDepth, 8, 24)),
    aiSilenceThresholdMs: Math.round(normalizeNumber(input.aiSilenceThresholdMs, defaultSettings.aiSilenceThresholdMs, 3000, 12000)),
    aiInterventionRestMs: Math.round(normalizeNumber(input.aiInterventionRestMs, defaultSettings.aiInterventionRestMs, 4000, 20000)),
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
