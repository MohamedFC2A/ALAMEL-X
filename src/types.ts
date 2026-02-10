export type Language = 'en' | 'ar';

export type ThemeName = 'aurora' | 'solar' | 'onyx';
export type ContrastPreset = 'normal' | 'high';
export type UiDensity = 'comfortable' | 'compact';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type WordDifficulty = 'any' | Difficulty;
export type HintMode = 'weak' | 'normal' | 'off';

export type Winner = 'citizens' | 'spies';

export interface PlayerAccessibility {
  shortSightedMode: boolean;
  longSightedMode: boolean;
  extraReadMs: number;
  blurReduction: boolean;
  highContrast: boolean;
}

export interface PlayerStats {
  gamesPlayed: number;
  spyWins: number;
  citizenWins: number;
}

export interface Player {
  id: string;
  name: string;
  avatarId: string;
  enabled: boolean;
  accessibility: PlayerAccessibility;
  stats: PlayerStats;
  createdAt: number;
  updatedAt: number;
}

export interface GlobalSettings {
  id: 'global';
  uiScale: number;
  animationSpeed: number;
  reducedMotionMode: boolean;
  contrastPreset: ContrastPreset;
  uiDensity: UiDensity;
  soundEnabled: boolean;
  language: Language;
  pendingLanguage?: Language;
  theme: ThemeName;
  discussionMinutes: number;
  guessSeconds: number;
  wordDifficulty: WordDifficulty;
  hintMode: HintMode;
}

export interface WordEntry {
  id: string;
  text_en: string;
  text_ar: string;
  category: string;
  difficulty: Difficulty;
  hints: string[];
  decoys: string[];
}

export interface WordUsage {
  wordId: string;
  usedAt: number;
  matchId: string;
  category: string;
}

export interface Match {
  id: string;
  createdAt: number;
  playerIds: string[];
  spyIds: string[];
  wordId: string;
  category: string;
  status: MatchStatus;
}

export type MatchStatus = 'reveal' | 'ready' | 'discussion' | 'resolution' | 'summary' | 'completed';

export interface MatchRevealState {
  matchId: string;
  currentRevealIndex: number;
  revealedPlayerIds: string[];
  canBack: boolean;
  phase: 'handoff' | 'reveal';
}

export interface MatchResult {
  matchId: string;
  votedSpyIds: string[];
  spyGuess: string;
  spyGuessCorrect: boolean;
  winner: Winner;
}

export interface ResolutionVoteState {
  phase: 'handoff' | 'ballot';
  voterIndex: number;
  ballots: Record<string, string>;
  round: 1 | 2;
  candidates?: string[];
  lastTally?: Record<string, number>;
}

export interface ActiveMatch {
  id: 'active';
  match: Match;
  revealState: MatchRevealState;
  uiPhaseLabel: 'setup' | 'reveal' | 'discussion' | 'resolution' | 'summary';
  transitionLock: boolean;
  resolutionStage: 'vote' | 'guess' | 'result';
  discussionEndsAt?: number;
  guessEndsAt?: number;
  votedSpyIds: string[];
  voteState?: ResolutionVoteState;
  spyGuess: string;
  spyGuessCorrect: boolean;
  voteOutcome?: 'captured' | 'missed';
  guessTimedOut?: boolean;
  spyGuessOptionsEn: string[];
  spyGuessOptionsAr: string[];
  winner?: Winner;
  wordTextEn: string;
  wordTextAr: string;
  spyHintEn: string;
  spyHintAr: string;
  decoysEn: string[];
  decoysAr: string[];
}

export interface MatchRecord {
  id: string;
  match: Match;
  result: MatchResult;
  endedAt: number;
  wordTextEn: string;
  wordTextAr: string;
  decoysEn: string[];
  decoysAr: string[];
}

export interface WordPackPayload {
  version: number;
  generatedAt: string;
  words: WordEntry[];
}

export interface TeaserOptIn {
  id: 'ai_teaser';
  wantsNotify: boolean;
  updatedAt: number;
}
