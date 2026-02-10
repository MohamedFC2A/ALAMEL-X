import type {
  ActiveMatch,
  ActiveMatchAiState,
  AiAdaptiveStats,
  GlobalSettings,
  Match,
  MatchRecord,
  MatchResult,
  MatchStatus,
  Player,
  Winner,
} from '../types';
import { defaultAccessibility, db, defaultSettings, ensureSettings, normalizeGlobalSettings } from './db';
import { createId, shuffle } from './utils';
import { loadWordPack, pickBalancedUnusedWord } from './word-engine';
import { extractCoreWord, formatWordForDisplay, normalizeWord } from './word-format';

export function buildPlayer(name: string, avatarId: string): Player {
  const now = Date.now();
  return {
    id: createId('player'),
    name,
    avatarId,
    enabled: true,
    accessibility: { ...defaultAccessibility },
    stats: {
      gamesPlayed: 0,
      spyWins: 0,
      citizenWins: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function buildQuickPlayers(): Player[] {
  const presets = [
    { name: 'لاعب ١', avatarId: 'boy_1' },
    { name: 'لاعب ٢', avatarId: 'girl_1' },
    { name: 'لاعب ٣', avatarId: 'boy_2' },
    { name: 'لاعب ٤', avatarId: 'girl_2' },
  ];
  return presets.map((preset) => buildPlayer(preset.name, preset.avatarId));
}

const AI_CODENAMES = [
  'العميل صقر',
  'العميل برق',
  'العميل نسر',
  'العميل ظل',
  'العميل كود',
  'العميل فهد',
  'العميل موج',
  'العميل رعد',
  'العميلة ندى',
  'العميلة لؤلؤ',
  'العميلة فجر',
  'العميلة ورد',
  'العميلة سحاب',
  'العميلة برق',
  'العميلة مرجان',
  'العميل حجر',
  'العميل ميزان',
  'العميلة عين',
  'العميل نقطة',
  'العميلة شيفرة',
];

function normalizePlayerName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

export async function buildAiPlayer(): Promise<Player> {
  const existingNames = new Set((await db.players.toArray()).map((player) => normalizePlayerName(player.name)));
  const baseName = AI_CODENAMES[Math.floor(Math.random() * AI_CODENAMES.length)] ?? 'العميل X';
  let candidate = baseName;
  let suffix = 2;
  while (existingNames.has(normalizePlayerName(candidate))) {
    candidate = `${baseName} ${suffix}`;
    suffix += 1;
  }

  return {
    ...buildPlayer(candidate, 'ai_bot'),
    kind: 'ai',
  };
}

export async function upsertPlayer(player: Player): Promise<void> {
  await db.players.put({
    ...player,
    updatedAt: Date.now(),
  });
}

export async function togglePlayerEnabled(playerId: string, enabled: boolean): Promise<void> {
  await db.players.update(playerId, { enabled, updatedAt: Date.now() });
}

export function assignSpies(playerIds: string[], spyCount: 1 | 2): string[] {
  return shuffle(playerIds).slice(0, spyCount);
}

export function minPlayersForSpyCount(spyCount: 1 | 2): number {
  return spyCount === 2 ? 4 : 3;
}

export function isValidPlayerCount(playerCount: number, spyCount: 1 | 2): boolean {
  return playerCount >= minPlayersForSpyCount(spyCount) && playerCount <= 10;
}

export function buildGuessOptions(
  language: 'en' | 'ar',
  correct: string,
  similar: string[],
  related: string[],
  extra: string | undefined,
  sameCategoryPool: string[],
  otherPool: string[],
): string[] {
  const formattedCorrect = formatWordForDisplay(correct, language);
  const normalizedCorrect = normalizeWord(formattedCorrect);
  const decoyOptions = new Map<string, string>();

  const addDecoyOption = (value?: string) => {
    if (!value) {
      return;
    }
    const formatted = formatWordForDisplay(value, language);
    const key = normalizeWord(formatted);
    if (!key || key === normalizedCorrect || decoyOptions.has(key)) {
      return;
    }
    decoyOptions.set(key, formatted);
  };

  [...similar, ...related, extra].forEach((value) => addDecoyOption(value));

  if (decoyOptions.size < 4) {
    const rankedSameCategory = [...sameCategoryPool].sort((left, right) => {
      const leftScore = similarityScore(left, correct);
      const rightScore = similarityScore(right, correct);
      return rightScore - leftScore;
    });
    for (const value of rankedSameCategory) {
      addDecoyOption(value);
      if (decoyOptions.size >= 4) {
        break;
      }
    }
  }

  if (decoyOptions.size < 4) {
    for (const value of shuffle(otherPool)) {
      addDecoyOption(value);
      if (decoyOptions.size >= 4) {
        break;
      }
    }
  }

  const finalOptions = shuffle([formattedCorrect, ...shuffle([...decoyOptions.values()]).slice(0, 4)]);
  const hasCorrect = finalOptions.some((value) => normalizeWord(value) === normalizedCorrect);

  if (hasCorrect) {
    return finalOptions.slice(0, 5);
  }

  if (finalOptions.length === 0) {
    return [formattedCorrect];
  }

  finalOptions[finalOptions.length - 1] = formattedCorrect;
  return finalOptions.slice(0, 5);
}

function similarityScore(candidate: string, reference: string): number {
  const leftTokens = normalizeWord(candidate).split(' ').filter(Boolean);
  const rightTokens = normalizeWord(reference).split(' ').filter(Boolean);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightSet = new Set(rightTokens);
  let shared = 0;
  for (const token of leftTokens) {
    if (rightSet.has(token)) {
      shared += 1;
    }
  }

  const prefixBonus = leftTokens[0] === rightTokens[0] ? 0.35 : 0;
  return shared / Math.max(leftTokens.length, rightTokens.length) + prefixBonus;
}

function normalizeAdaptiveStats(stats: AiAdaptiveStats | undefined): AiAdaptiveStats {
  const fallback = defaultSettings.aiAdaptiveStats;
  if (!stats) {
    return { ...fallback, memoryBank: [...fallback.memoryBank], updatedAt: Date.now() };
  }
  return {
    matchesPlayed: Number.isFinite(stats.matchesPlayed) ? Math.max(0, stats.matchesPlayed) : 0,
    spyRounds: Number.isFinite(stats.spyRounds) ? Math.max(0, stats.spyRounds) : 0,
    citizenRounds: Number.isFinite(stats.citizenRounds) ? Math.max(0, stats.citizenRounds) : 0,
    spyWins: Number.isFinite(stats.spyWins) ? Math.max(0, stats.spyWins) : 0,
    citizenWins: Number.isFinite(stats.citizenWins) ? Math.max(0, stats.citizenWins) : 0,
    successfulSpyGuesses: Number.isFinite(stats.successfulSpyGuesses) ? Math.max(0, stats.successfulSpyGuesses) : 0,
    failedSpyGuesses: Number.isFinite(stats.failedSpyGuesses) ? Math.max(0, stats.failedSpyGuesses) : 0,
    successfulCaptures: Number.isFinite(stats.successfulCaptures) ? Math.max(0, stats.successfulCaptures) : 0,
    missedCaptures: Number.isFinite(stats.missedCaptures) ? Math.max(0, stats.missedCaptures) : 0,
    averageSignalStrength: Number.isFinite(stats.averageSignalStrength) ? Math.max(0, stats.averageSignalStrength) : 0,
    memoryBank: Array.isArray(stats.memoryBank) ? stats.memoryBank.slice(0, 36) : [],
    updatedAt: Number.isFinite(stats.updatedAt) ? stats.updatedAt : Date.now(),
  };
}

function estimateMatchSignalStrength(active: ActiveMatch): number {
  const aiThreads = Object.values(active.ai?.threads ?? {});
  if (!aiThreads.length) {
    return 0;
  }

  let total = 0;
  for (const thread of aiThreads) {
    const userMessages = (thread.messages ?? []).filter((entry) => entry.from === 'user').length;
    const aiMessages = (thread.messages ?? []).filter((entry) => entry.from === 'ai').length;
    const summaryLen = (thread.summary ?? '').trim().length;
    total += Math.min(10, userMessages) * 4 + Math.min(10, aiMessages) * 2 + Math.min(120, summaryLen) * 0.1;
  }
  return Math.round(total / aiThreads.length);
}

function buildAdaptiveMemoryEntry(active: ActiveMatch, winner: Winner): string {
  const roleSummary =
    active.match.spyIds.length > 1
      ? `عدد الجواسيس كان ${active.match.spyIds.length}`
      : 'كان في جاسوس واحد';
  const voteSummary =
    active.voteOutcome === 'captured'
      ? 'التصويت قدر يحدد الجاسوس'
      : active.voteOutcome === 'missed'
        ? 'التصويت فشل في تحديد الجاسوس'
        : 'مرحلة التصويت انتهت';
  const guessSummary = active.spyGuess
    ? active.spyGuessCorrect
      ? 'الجاسوس خمّن صح'
      : 'الجاسوس خمّن غلط'
    : active.guessTimedOut
      ? 'الجاسوس ما خمّنش في الوقت'
      : 'مافيش تخمين واضح';

  return `${active.match.category} | ${roleSummary} | ${voteSummary} | ${guessSummary} | الفائز: ${winner}`;
}

function mergeAdaptiveStats(
  current: AiAdaptiveStats | undefined,
  active: ActiveMatch,
  winner: Winner,
): AiAdaptiveStats {
  const base = normalizeAdaptiveStats(current);
  const isSpyWin = winner === 'spies';
  const spyCount = active.match.spyIds.length;
  const signal = estimateMatchSignalStrength(active);
  const nextMatches = base.matchesPlayed + 1;

  const memoryEntry = buildAdaptiveMemoryEntry(active, winner);
  const nextMemoryBank = [memoryEntry, ...base.memoryBank].slice(0, 30);

  const spyGuessAttempted = active.resolutionStage === 'result' || Boolean(active.spyGuess) || Boolean(active.guessTimedOut);
  const guessSuccess = Boolean(active.spyGuess) && active.spyGuessCorrect;

  return {
    ...base,
    matchesPlayed: nextMatches,
    spyRounds: base.spyRounds + spyCount,
    citizenRounds: base.citizenRounds + Math.max(0, active.match.playerIds.length - spyCount),
    spyWins: base.spyWins + (isSpyWin ? 1 : 0),
    citizenWins: base.citizenWins + (!isSpyWin ? 1 : 0),
    successfulSpyGuesses: base.successfulSpyGuesses + (guessSuccess ? 1 : 0),
    failedSpyGuesses: base.failedSpyGuesses + (spyGuessAttempted && !guessSuccess ? 1 : 0),
    successfulCaptures: base.successfulCaptures + (active.voteOutcome === 'captured' ? 1 : 0),
    missedCaptures: base.missedCaptures + (active.voteOutcome === 'missed' ? 1 : 0),
    averageSignalStrength: Number(((base.averageSignalStrength * base.matchesPlayed + signal) / nextMatches).toFixed(2)),
    memoryBank: nextMemoryBank,
    updatedAt: Date.now(),
  };
}

function mapRelatedWords(words: string[], relatedList: string[]): string[] {
  const normalized = new Set(relatedList.map((item) => normalizeWord(item)).filter(Boolean));
  return words.filter((item) => normalized.has(normalizeWord(item)));
}

export async function startMatch(playerIds: string[], spyCount: 1 | 2): Promise<ActiveMatch> {
  if (!isValidPlayerCount(playerIds.length, spyCount)) {
    throw new Error('INVALID_PLAYER_COUNT');
  }

  if (spyCount !== 1 && spyCount !== 2) {
    throw new Error('INVALID_SPY_COUNT');
  }

  const settings = await ensureSettings();
  const selection = await pickBalancedUnusedWord(settings.wordDifficulty ?? 'any');
  const allWords = await loadWordPack();
  const matchId = createId('match');
  const spies = assignSpies(playerIds, spyCount);

  const match: Match = {
    id: matchId,
    createdAt: Date.now(),
    playerIds,
    spyIds: spies,
    wordId: selection.word.id,
    category: selection.word.category,
    status: 'reveal',
  };

  const playerEntities = await db.players.bulkGet(playerIds);
  const aiPlayerIds = playerEntities
    .filter((player): player is Player => Boolean(player))
    .filter((player) => player.kind === 'ai')
    .map((player) => player.id);
  const aiState =
    aiPlayerIds.length > 0
      ? {
          playerIds: aiPlayerIds,
          threads: Object.fromEntries(aiPlayerIds.map((id) => [id, { messages: [], summary: '' }])),
        }
      : undefined;

  const wordTextEn = extractCoreWord(selection.word.text_en, 'en');
  const wordTextAr = extractCoreWord(selection.word.text_ar, 'ar');
  const decoysEn = selection.decoys.map((entry) => extractCoreWord(entry.text_en, 'en'));
  const decoysAr = selection.decoys.map((entry) => extractCoreWord(entry.text_ar, 'ar'));

  const hintMode = settings.hintMode ?? 'weak';
  const weakHintEn = 'Focus on the category and general context.';
  const weakHintAr = 'ركّز على نوع الكلمة والسياق العام فقط.';
  const offHintEn = 'No hint.';
  const offHintAr = 'بدون تلميح.';
  const spyHintEn =
    hintMode === 'off'
      ? offHintEn
      : hintMode === 'weak'
        ? weakHintEn
        : selection.word.hints[0] ?? weakHintEn;
  const spyHintAr =
    hintMode === 'off'
      ? offHintAr
      : hintMode === 'weak'
        ? weakHintAr
        : selection.word.hints[1] ?? weakHintAr;

  const activeMatch: ActiveMatch = {
    id: 'active',
    match,
    revealState: {
      matchId,
      currentRevealIndex: 0,
      revealedPlayerIds: [],
      canBack: false,
      phase: 'handoff',
    },
    uiPhaseLabel: 'reveal',
    transitionLock: false,
    resolutionStage: 'vote',
    ai: aiState,
    votedSpyIds: [],
    voteState: {
      phase: 'handoff',
      voterIndex: 0,
      ballots: {},
      round: 1,
    },
    spyGuess: '',
    spyGuessCorrect: false,
    spyGuessOptionsEn: [],
    spyGuessOptionsAr: [],
    wordTextEn,
    wordTextAr,
    spyHintEn,
    spyHintAr,
    decoysEn,
    decoysAr,
  };

  const sameCategoryPool = allWords.filter(
    (entry) => entry.category === selection.word.category && entry.id !== selection.word.id,
  );
  const otherCategoryPool = allWords.filter((entry) => entry.category !== selection.word.category);
  const relatedAr = mapRelatedWords(
    sameCategoryPool.map((entry) => extractCoreWord(entry.text_ar, 'ar')),
    selection.word.decoys,
  );
  const relatedEn = mapRelatedWords(
    sameCategoryPool.map((entry) => extractCoreWord(entry.text_en, 'en')),
    selection.word.decoys,
  );

  activeMatch.spyGuessOptionsEn = buildGuessOptions(
    'en',
    wordTextEn,
    decoysEn,
    relatedEn,
    selection.extraDecoy?.text_en ? extractCoreWord(selection.extraDecoy.text_en, 'en') : undefined,
    sameCategoryPool.map((entry) => extractCoreWord(entry.text_en, 'en')),
    otherCategoryPool.map((entry) => extractCoreWord(entry.text_en, 'en')),
  );
  activeMatch.spyGuessOptionsAr = buildGuessOptions(
    'ar',
    wordTextAr,
    decoysAr,
    relatedAr,
    selection.extraDecoy?.text_ar ? extractCoreWord(selection.extraDecoy.text_ar, 'ar') : undefined,
    sameCategoryPool.map((entry) => extractCoreWord(entry.text_ar, 'ar')),
    otherCategoryPool.map((entry) => extractCoreWord(entry.text_ar, 'ar')),
  );

  await db.transaction('rw', db.activeMatch, db.wordUsage, async () => {
    await db.activeMatch.put(activeMatch);
    await db.wordUsage.put({
      wordId: selection.word.id,
      usedAt: Date.now(),
      matchId,
      category: selection.word.category,
    });
  });

  return activeMatch;
}

export async function updateActiveMatch(patch: Partial<ActiveMatch>): Promise<void> {
  const active = await db.activeMatch.get('active');
  if (!active) {
    return;
  }

  const patchAi = patch.ai as Partial<ActiveMatchAiState> | undefined;
  const mergedAi = patchAi
    ? {
        playerIds: patchAi.playerIds ?? active.ai?.playerIds ?? [],
        threads: {
          ...(active.ai?.threads ?? {}),
          ...(patchAi.threads ?? {}),
        },
      }
    : active.ai;

  await db.activeMatch.put({
    ...active,
    ...patch,
    match: {
      ...active.match,
      ...(patch.match ?? {}),
    },
    revealState: {
      ...active.revealState,
      ...(patch.revealState ?? {}),
    },
    ai: mergedAi,
  });
}

export function tallyBallots(ballots: Record<string, string>): { counts: Record<string, number>; leaders: string[] } {
  const counts: Record<string, number> = {};

  for (const choice of Object.values(ballots)) {
    if (!choice) {
      continue;
    }
    counts[choice] = (counts[choice] ?? 0) + 1;
  }

  const values = Object.values(counts);
  const max = values.length > 0 ? Math.max(...values) : 0;
  const leaders = Object.entries(counts)
    .filter(([, count]) => count === max)
    .map(([id]) => id)
    .sort();

  return { counts, leaders };
}

function hashToUint32(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickWinnerFromLeaders(leaders: string[], matchId: string, round: 1 | 2): string {
  if (leaders.length === 0) {
    return '';
  }
  const seed = hashToUint32(`${matchId}:${round}`);
  return leaders[seed % leaders.length];
}

export function computeVoteOutcome(activeMatch: ActiveMatch): boolean {
  const winnerId = activeMatch.votedSpyIds[0];
  if (!winnerId) {
    return false;
  }
  return activeMatch.match.spyIds.includes(winnerId);
}

export function computeSpyGuessCorrect(activeMatch: ActiveMatch, guess: string): boolean {
  const normalizedGuess = normalizeWord(guess);
  const expectedEnCore = normalizeWord(extractCoreWord(activeMatch.wordTextEn, 'en'));
  const expectedArCore = normalizeWord(extractCoreWord(activeMatch.wordTextAr, 'ar'));
  const expectedEnFull = normalizeWord(activeMatch.wordTextEn);
  const expectedArFull = normalizeWord(activeMatch.wordTextAr);
  return (
    normalizedGuess === expectedEnCore ||
    normalizedGuess === expectedArCore ||
    normalizedGuess === expectedEnFull ||
    normalizedGuess === expectedArFull
  );
}

export function resolveWinner(citizensIdentified: boolean, spyGuessCorrect: boolean): Winner {
  if (!citizensIdentified) {
    return 'spies';
  }
  return spyGuessCorrect ? 'spies' : 'citizens';
}

async function updatePlayerStats(match: Match, winner: Winner): Promise<void> {
  const players = await db.players.bulkGet(match.playerIds);
  const updates = players
    .filter((player): player is Player => Boolean(player))
    .map((player) => {
      const isSpy = match.spyIds.includes(player.id);
      const spyWin = winner === 'spies' && isSpy;
      const citizenWin = winner === 'citizens' && !isSpy;

      return {
        ...player,
        stats: {
          gamesPlayed: player.stats.gamesPlayed + 1,
          spyWins: player.stats.spyWins + (spyWin ? 1 : 0),
          citizenWins: player.stats.citizenWins + (citizenWin ? 1 : 0),
        },
        updatedAt: Date.now(),
      };
    });

  if (updates.length > 0) {
    await db.players.bulkPut(updates);
  }
}

export async function completeActiveMatch(): Promise<MatchRecord> {
  const active = await db.activeMatch.get('active');
  if (!active) {
    throw new Error('NO_ACTIVE_MATCH');
  }

  const settings = await ensureSettings();

  const citizensIdentified = computeVoteOutcome(active);
  const winner = resolveWinner(citizensIdentified, active.spyGuessCorrect);

  const result: MatchResult = {
    matchId: active.match.id,
    votedSpyIds: active.votedSpyIds,
    spyGuess: active.spyGuess,
    spyGuessCorrect: active.spyGuessCorrect,
    winner,
  };

  const record: MatchRecord = {
    id: active.match.id,
    match: {
      ...active.match,
      status: 'completed',
    },
    result,
    endedAt: Date.now(),
    wordTextEn: active.wordTextEn,
    wordTextAr: active.wordTextAr,
    decoysEn: active.decoysEn,
    decoysAr: active.decoysAr,
  };

  const nextAdaptiveStats = mergeAdaptiveStats(settings.aiAdaptiveStats, active, winner);

  await db.transaction('rw', db.matches, db.activeMatch, db.players, db.settings, async () => {
    await db.matches.put(record);
    await updatePlayerStats(active.match, winner);
    await db.settings.put(
      normalizeGlobalSettings({
      ...settings,
      aiAdaptiveStats: nextAdaptiveStats,
      id: 'global',
      }),
    );
    await db.activeMatch.delete('active');
  });

  return record;
}

export async function ensureGlobalSettings(): Promise<GlobalSettings> {
  return ensureSettings();
}

export async function updateGlobalSettings(patch: Partial<GlobalSettings>): Promise<void> {
  const current = await ensureSettings();
  const merged: GlobalSettings = {
    ...current,
    ...patch,
    id: 'global',
    aiAdaptiveStats: {
      ...current.aiAdaptiveStats,
      ...(patch.aiAdaptiveStats ?? {}),
    },
  };
  await db.settings.put(normalizeGlobalSettings(merged));
}

export async function resetWordLocks(): Promise<void> {
  await db.wordUsage.clear();
}

export async function wordsUsageSummary(): Promise<{ used: number; total: number }> {
  const used = await db.wordUsage.count();
  const allWords = await (await import('./word-engine')).loadWordPack();
  return { used, total: allWords.length };
}

export function nextStatusAfterReveal(isLastPlayer: boolean): MatchStatus {
  return isLastPlayer ? 'ready' : 'reveal';
}
