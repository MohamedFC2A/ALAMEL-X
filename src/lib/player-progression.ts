import type {
  MatchRoundAwardEvent,
  MedalTier,
  Player,
  PlayerProgressEvent,
  PlayerProgressMetrics,
  PlayerProgression,
  Winner,
} from '../types';

export interface MedalDefinition {
  id: string;
  name: string;
  xp: number;
  tier: MedalTier;
}

interface MedalRule extends MedalDefinition {
  condition: (params: { metrics: PlayerProgressMetrics; unlockedCount: number }) => boolean;
}

export interface RoundProgressionContext {
  now: number;
  role: 'spy' | 'citizen';
  teamWon: boolean;
  winner: Winner;
  spyCount: 1 | 2;
  voteOutcome?: 'captured' | 'missed';
  spyGuessCorrect: boolean;
  wasRunoff: boolean;
}

export interface RoundProgressionResult {
  updatedPlayer: Player;
  newlyUnlockedMedals: MedalDefinition[];
  newLevels: number[];
}

export const levelThresholds = [
  0,
  120,
  260,
  420,
  600,
  800,
  1020,
  1260,
  1520,
  1800,
  2100,
  2420,
  2760,
  3120,
  3500,
  3900,
  4320,
  4760,
  5220,
  5400,
] as const;

const MAX_STATIC_XP = levelThresholds[levelThresholds.length - 1];
const POST_20_BASE_XP_STEP = 60;
const POST_20_STEP_GROWTH = 25;

const medalRules: MedalRule[] = [
  { id: 'first_step', name: 'خطوة البداية', xp: 80, tier: 'bronze', condition: ({ metrics }) => metrics.matchesPlayed >= 1 },
  { id: 'field_agent', name: 'عميل الميدان', xp: 90, tier: 'bronze', condition: ({ metrics }) => metrics.matchesPlayed >= 5 },
  { id: 'ops_regular', name: 'مناوب ثابت', xp: 120, tier: 'silver', condition: ({ metrics }) => metrics.matchesPlayed >= 15 },
  { id: 'seasoned_operative', name: 'مخضرم العمليات', xp: 170, tier: 'gold', condition: ({ metrics }) => metrics.matchesPlayed >= 30 },
  { id: 'mission_legend', name: 'أسطورة المهمات', xp: 260, tier: 'mythic', condition: ({ metrics }) => metrics.matchesPlayed >= 60 },
  { id: 'first_win', name: 'أول انتصار', xp: 90, tier: 'bronze', condition: ({ metrics }) => metrics.winsTotal >= 1 },
  { id: 'double_strike', name: 'ضربة مزدوجة', xp: 130, tier: 'silver', condition: ({ metrics }) => metrics.winStreak >= 2 },
  { id: 'triple_strike', name: 'ضربة ثلاثية', xp: 180, tier: 'gold', condition: ({ metrics }) => metrics.winStreak >= 3 },
  { id: 'unstoppable_five', name: 'سلسلة لا تنكسر', xp: 240, tier: 'mythic', condition: ({ metrics }) => metrics.winStreak >= 5 },
  { id: 'comeback_king', name: 'عودة خارقة', xp: 180, tier: 'gold', condition: ({ metrics }) => metrics.comebackWins >= 1 },
  { id: 'spy_debut', name: 'جاسوس ناشئ', xp: 100, tier: 'bronze', condition: ({ metrics }) => metrics.spyWinsTotal >= 1 },
  { id: 'spy_chain_two', name: 'جاسوس متتالي', xp: 140, tier: 'silver', condition: ({ metrics }) => metrics.spyWinStreak >= 2 },
  { id: 'shadow_master', name: 'سيد الظل', xp: 190, tier: 'gold', condition: ({ metrics }) => metrics.spyWinsTotal >= 5 },
  { id: 'shadow_overlord', name: 'شبح القيادة', xp: 250, tier: 'mythic', condition: ({ metrics }) => metrics.spyWinsTotal >= 12 },
  { id: 'ghost_escape', name: 'إفلات ذكي', xp: 180, tier: 'gold', condition: ({ metrics }) => metrics.spyEscapes >= 3 },
  { id: 'sniper_guesser', name: 'تخمين قناص', xp: 210, tier: 'gold', condition: ({ metrics }) => metrics.spyCorrectGuesses >= 3 },
  { id: 'breach_mind', name: 'عقل اختراق', xp: 260, tier: 'mythic', condition: ({ metrics }) => metrics.spyCorrectGuesses >= 8 },
  { id: 'citizen_debut', name: 'درع المواطنين', xp: 100, tier: 'bronze', condition: ({ metrics }) => metrics.citizenWinsTotal >= 1 },
  { id: 'city_guard', name: 'حارس المدينة', xp: 140, tier: 'silver', condition: ({ metrics }) => metrics.citizenWinsTotal >= 5 },
  { id: 'iron_bastion', name: 'حصن لا يهتز', xp: 200, tier: 'gold', condition: ({ metrics }) => metrics.citizenWinsTotal >= 12 },
  { id: 'spy_hunter_i', name: 'صياد الجواسيس I', xp: 150, tier: 'silver', condition: ({ metrics }) => metrics.citizenCaptureWins >= 3 },
  { id: 'spy_hunter_ii', name: 'صياد الجواسيس II', xp: 220, tier: 'gold', condition: ({ metrics }) => metrics.citizenCaptureWins >= 8 },
  { id: 'cold_detective', name: 'محقق بارد', xp: 240, tier: 'mythic', condition: ({ metrics }) => metrics.citizenCaptureWinStreak >= 3 },
  { id: 'runoff_clutch', name: 'حسم الإعادة', xp: 190, tier: 'gold', condition: ({ metrics }) => metrics.runoffWins >= 1 },
  { id: 'duo_survivor', name: 'ناجي الثنائي', xp: 150, tier: 'silver', condition: ({ metrics }) => metrics.duoWinsAny >= 3 },
  { id: 'duo_hunter', name: 'قاهر الثنائي', xp: 210, tier: 'gold', condition: ({ metrics }) => metrics.duoCitizenWins >= 3 },
  { id: 'duo_shadowmate', name: 'شريك الظلال', xp: 210, tier: 'gold', condition: ({ metrics }) => metrics.duoSpyWins >= 3 },
  { id: 'duo_emperor', name: 'إمبراطور الثنائي', xp: 260, tier: 'mythic', condition: ({ metrics }) => metrics.duoSpyWins >= 6 },
  { id: 'collector_i', name: 'جامع الشارات I', xp: 220, tier: 'gold', condition: ({ unlockedCount }) => unlockedCount >= 10 },
  { id: 'collector_ii', name: 'جامع الشارات II', xp: 300, tier: 'mythic', condition: ({ unlockedCount }) => unlockedCount >= 20 },
];

export const medalCatalog: MedalDefinition[] = medalRules.map((medal) => ({
  id: medal.id,
  name: medal.name,
  xp: medal.xp,
  tier: medal.tier,
}));

const medalById = new Map(medalCatalog.map((medal) => [medal.id, medal]));

const tierRank: Record<MedalTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  mythic: 4,
};

function createEventId(prefix: string, now: number, index: number): string {
  return `${prefix}_${now}_${index}`;
}

export function createDefaultProgressMetrics(): PlayerProgressMetrics {
  return {
    matchesPlayed: 0,
    winsTotal: 0,
    lossesTotal: 0,
    winStreak: 0,
    loseStreak: 0,
    spyRoundsPlayed: 0,
    citizenRoundsPlayed: 0,
    spyWinStreak: 0,
    spyWinsTotal: 0,
    citizenWinsTotal: 0,
    comebackWins: 0,
    spyEscapes: 0,
    spyCorrectGuesses: 0,
    citizenCaptureWins: 0,
    citizenCaptureWinStreak: 0,
    runoffWins: 0,
    duoWinsAny: 0,
    duoCitizenWins: 0,
    duoSpyWins: 0,
  };
}

export function createDefaultProgression(now = Date.now()): PlayerProgression {
  return {
    xp: 0,
    level: 1,
    medals: [],
    metrics: createDefaultProgressMetrics(),
    events: [],
    updatedAt: now,
  };
}

export function ensureProgressionState(input: PlayerProgression | undefined, now = Date.now()): PlayerProgression {
  if (!input) {
    return createDefaultProgression(now);
  }

  return {
    ...createDefaultProgression(now),
    ...input,
    metrics: {
      ...createDefaultProgressMetrics(),
      ...(input.metrics ?? {}),
    },
    medals: Array.isArray(input.medals) ? input.medals : [],
    events: Array.isArray(input.events) ? input.events : [],
    updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : now,
  };
}

export function getLevelThreshold(level: number): number {
  if (!Number.isFinite(level) || level <= 1) {
    return 0;
  }

  if (level <= levelThresholds.length) {
    return levelThresholds[level - 1];
  }

  const extraLevels = level - levelThresholds.length;
  const extraXp =
    extraLevels * POST_20_BASE_XP_STEP +
    ((extraLevels - 1) * extraLevels * POST_20_STEP_GROWTH) / 2;

  return MAX_STATIC_XP + Math.max(0, Math.floor(extraXp));
}

export function getLevelForXp(xp: number): number {
  const normalizedXp = Math.max(0, Math.floor(xp));

  for (let index = levelThresholds.length - 1; index >= 0; index -= 1) {
    if (normalizedXp >= levelThresholds[index]) {
      if (normalizedXp <= MAX_STATIC_XP) {
        return index + 1;
      }
      break;
    }
  }

  if (normalizedXp <= MAX_STATIC_XP) {
    return 1;
  }

  let level = levelThresholds.length;
  let nextLevelThreshold = getLevelThreshold(level + 1);
  while (normalizedXp >= nextLevelThreshold) {
    level += 1;
    nextLevelThreshold = getLevelThreshold(level + 1);
  }
  return level;
}

export function getNextLevelThreshold(level: number): number | null {
  if (!Number.isFinite(level) || level < 1) {
    return levelThresholds[1] ?? null;
  }
  return getLevelThreshold(level + 1);
}

export function countUnlockedMedals(progression: PlayerProgression | undefined): number {
  return ensureProgressionState(progression).medals.length;
}

export function getMedalDefinitionById(medalId: string): MedalDefinition | undefined {
  return medalById.get(medalId);
}

export function getUnlockedMedalsForDisplay(progression: PlayerProgression | undefined, limit = 5): MedalDefinition[] {
  const state = ensureProgressionState(progression);
  const unlocked = state.medals
    .map((entry) => ({ entry, medal: medalById.get(entry.medalId) }))
    .filter((item): item is { entry: { medalId: string; unlockedAt: number }; medal: MedalDefinition } => Boolean(item.medal))
    .sort((left, right) => {
      const tierDiff = tierRank[right.medal.tier] - tierRank[left.medal.tier];
      if (tierDiff !== 0) {
        return tierDiff;
      }
      return right.entry.unlockedAt - left.entry.unlockedAt;
    })
    .map((item) => item.medal);

  return unlocked.slice(0, Math.max(0, limit));
}

export function buildAwardSummaryText(award: MatchRoundAwardEvent): string {
  const medals = award.medalIds
    .map((medalId) => medalById.get(medalId)?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join('، ');

  const levelText = award.levelUps.length ? `وصل إلى ليفل ${award.levelAfter}` : '';
  if (medals && levelText) {
    return `${award.playerName}: ${medals}. ${levelText}.`;
  }
  if (medals) {
    return `${award.playerName}: ${medals}.`;
  }
  if (levelText) {
    return `${award.playerName}: ${levelText}.`;
  }
  return '';
}

function updateMetrics(base: PlayerProgressMetrics, context: RoundProgressionContext): PlayerProgressMetrics {
  const metrics: PlayerProgressMetrics = {
    ...base,
  };

  const previousLoseStreak = metrics.loseStreak;
  metrics.matchesPlayed += 1;

  if (context.role === 'spy') {
    metrics.spyRoundsPlayed += 1;
  } else {
    metrics.citizenRoundsPlayed += 1;
  }

  if (context.teamWon) {
    metrics.winsTotal += 1;
    metrics.winStreak += 1;
    metrics.loseStreak = 0;
    if (previousLoseStreak >= 3) {
      metrics.comebackWins += 1;
    }
  } else {
    metrics.lossesTotal += 1;
    metrics.loseStreak += 1;
    metrics.winStreak = 0;
  }

  if (context.role === 'spy' && context.teamWon) {
    metrics.spyWinsTotal += 1;
    metrics.spyWinStreak += 1;
  } else {
    metrics.spyWinStreak = 0;
  }

  if (context.role === 'citizen' && context.teamWon) {
    metrics.citizenWinsTotal += 1;
  }

  if (context.role === 'spy' && context.winner === 'spies' && context.voteOutcome === 'missed') {
    metrics.spyEscapes += 1;
  }

  if (context.role === 'spy' && context.spyGuessCorrect) {
    metrics.spyCorrectGuesses += 1;
  }

  const isCitizenCaptureWin =
    context.role === 'citizen' && context.teamWon && context.voteOutcome === 'captured';
  if (isCitizenCaptureWin) {
    metrics.citizenCaptureWins += 1;
    metrics.citizenCaptureWinStreak += 1;
  } else {
    metrics.citizenCaptureWinStreak = 0;
  }

  if (context.teamWon && context.wasRunoff) {
    metrics.runoffWins += 1;
  }

  if (context.spyCount === 2 && context.teamWon) {
    metrics.duoWinsAny += 1;
    if (context.role === 'citizen') {
      metrics.duoCitizenWins += 1;
    }
    if (context.role === 'spy') {
      metrics.duoSpyWins += 1;
    }
  }

  return metrics;
}

function unlockMedals(metrics: PlayerProgressMetrics, currentMedals: { medalId: string; unlockedAt: number }[], now: number) {
  const unlockedIds = new Set(currentMedals.map((entry) => entry.medalId));
  const newlyUnlocked: MedalDefinition[] = [];
  const nextMedals = [...currentMedals];

  let changed = true;
  while (changed) {
    changed = false;
    for (const medal of medalRules) {
      if (unlockedIds.has(medal.id)) {
        continue;
      }
      const unlockedCount = nextMedals.length;
      if (!medal.condition({ metrics, unlockedCount })) {
        continue;
      }

      unlockedIds.add(medal.id);
      nextMedals.push({ medalId: medal.id, unlockedAt: now });
      newlyUnlocked.push({ id: medal.id, name: medal.name, xp: medal.xp, tier: medal.tier });
      changed = true;
    }
  }

  return { nextMedals, newlyUnlocked };
}

export function applyRoundProgression(player: Player, context: RoundProgressionContext): RoundProgressionResult {
  const baseProgression = ensureProgressionState(player.progression, context.now);
  const metrics = updateMetrics(baseProgression.metrics, context);
  const { nextMedals, newlyUnlocked } = unlockMedals(metrics, baseProgression.medals, context.now);

  const xpGain = newlyUnlocked.reduce((sum, medal) => sum + medal.xp, 0);
  const xpAfter = Math.max(0, baseProgression.xp + xpGain);
  const levelBefore = baseProgression.level;
  const levelAfter = getLevelForXp(xpAfter);

  const nextEvents: PlayerProgressEvent[] = [];
  let eventIndex = 0;
  for (const medal of newlyUnlocked) {
    nextEvents.push({
      id: createEventId('medal', context.now, eventIndex),
      type: 'medal_unlocked',
      at: context.now,
      medalId: medal.id,
      xpAfter,
    });
    eventIndex += 1;
  }

  const newLevels: number[] = [];
  if (levelAfter > levelBefore) {
    for (let level = levelBefore + 1; level <= levelAfter; level += 1) {
      newLevels.push(level);
      nextEvents.push({
        id: createEventId('level', context.now, eventIndex),
        type: 'level_up',
        at: context.now,
        level,
        xpAfter,
      });
      eventIndex += 1;
    }
  }

  const updatedProgression: PlayerProgression = {
    ...baseProgression,
    xp: xpAfter,
    level: levelAfter,
    medals: nextMedals,
    metrics,
    events: [...baseProgression.events, ...nextEvents],
    updatedAt: context.now,
  };

  return {
    updatedPlayer: {
      ...player,
      progression: updatedProgression,
      updatedAt: context.now,
    },
    newlyUnlockedMedals: newlyUnlocked,
    newLevels,
  };
}

export function buildRoundAwardEvent(player: Player, medals: MedalDefinition[], newLevels: number[]): MatchRoundAwardEvent {
  const progression = ensureProgressionState(player.progression);
  return {
    playerId: player.id,
    playerName: player.name,
    medalIds: medals.map((medal) => medal.id),
    levelUps: newLevels,
    xpAfter: progression.xp,
    levelAfter: progression.level,
  };
}
