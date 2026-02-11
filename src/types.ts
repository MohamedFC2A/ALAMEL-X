export type Language = 'en' | 'ar';

export type ThemeName = 'aurora' | 'solar' | 'onyx';
export type ContrastPreset = 'normal' | 'high';
export type UiDensity = 'comfortable' | 'compact';
export type AiHumanMode = 'strategic' | 'natural' | 'ultra';
export type AiReplyLength = 'short' | 'balanced' | 'detailed';
export type AiVoiceProvider = 'elevenlabs' | 'browser';
export type AiMatchMode = 'full' | 'vote_only';

export type PlayerKind = 'human' | 'ai';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type WordDifficulty = 'any' | Difficulty;
export type HintMode = 'weak' | 'normal' | 'off';

export type Winner = 'citizens' | 'spies';
export type MedalTier = 'bronze' | 'silver' | 'gold' | 'mythic';
export type ProgressEventType = 'medal_unlocked' | 'level_up';

export interface PlayerMedalState {
  medalId: string;
  unlockedAt: number;
}

export interface PlayerProgressEvent {
  id: string;
  type: ProgressEventType;
  at: number;
  medalId?: string;
  level?: number;
  xpAfter: number;
}

export interface PlayerProgressMetrics {
  matchesPlayed: number;
  winsTotal: number;
  lossesTotal: number;
  winStreak: number;
  loseStreak: number;
  spyRoundsPlayed: number;
  citizenRoundsPlayed: number;
  spyWinStreak: number;
  spyWinsTotal: number;
  citizenWinsTotal: number;
  comebackWins: number;
  spyEscapes: number;
  spyCorrectGuesses: number;
  citizenCaptureWins: number;
  citizenCaptureWinStreak: number;
  runoffWins: number;
  duoWinsAny: number;
  duoCitizenWins: number;
  duoSpyWins: number;
}

export interface PlayerProgression {
  xp: number;
  level: number;
  medals: PlayerMedalState[];
  metrics: PlayerProgressMetrics;
  events: PlayerProgressEvent[];
  updatedAt: number;
}

export interface AiAdaptiveStats {
  matchesPlayed: number;
  spyRounds: number;
  citizenRounds: number;
  spyWins: number;
  citizenWins: number;
  successfulSpyGuesses: number;
  failedSpyGuesses: number;
  successfulCaptures: number;
  missedCaptures: number;
  averageSignalStrength: number;
  memoryBank: string[];
  updatedAt: number;
}

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
  kind?: PlayerKind;
  enabled: boolean;
  accessibility: PlayerAccessibility;
  stats: PlayerStats;
  progression?: PlayerProgression;
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
  aiEnabled: boolean;
  aiProvider: 'deepseek';
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  aiHumanMode: AiHumanMode;
  aiReasoningDepth: 1 | 2 | 3;
  aiReplyLength: AiReplyLength;
  aiInitiativeLevel: number;
  aiMemoryDepth: number;
  aiVoiceInputEnabled: boolean;
  aiVoiceOutputEnabled: boolean;
  aiVoiceProvider: AiVoiceProvider;
  aiAutoFacilitatorEnabled: boolean;
  aiSilenceThresholdMs: number;
  aiInterventionRestMs: number;
  aiHumanSimulationEnabled: boolean;
  aiAdaptiveStats: AiAdaptiveStats;
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

export interface AiThreadMessage {
  at: number;
  from: 'user' | 'ai';
  text: string;
}

export interface AiThreadState {
  messages: AiThreadMessage[];
  summary: string;
}

export interface ActiveMatchAiState {
  playerIds: string[];
  mode?: AiMatchMode;
  threads: Record<string, AiThreadState>;
}

export interface ActiveMatch {
  id: 'active';
  match: Match;
  revealState: MatchRevealState;
  uiPhaseLabel: 'setup' | 'reveal' | 'discussion' | 'resolution' | 'summary';
  transitionLock: boolean;
  resolutionStage: 'vote' | 'guess' | 'result';
  ai?: ActiveMatchAiState;
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

export interface AiOrchestratorState {
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'waiting_answer';
  activeAiId: string;
  activeAiName: string;
  pendingTargetPlayerId: string;
  pendingTargetName: string;
  lastSpeakerName: string;
  lastTranscript: string;
  lastIntervention: string;
  silenceMs: number;
  isListening: boolean;
  isSpeaking: boolean;
  runtimeEnabled: boolean;
  updatedAt: number;
}

export interface ElevenTtsRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
}

export interface ElevenSttRequest {
  audioBase64: string;
  mimeType: string;
  languageCode?: string;
  modelId?: string;
}

export interface ElevenSttResponse {
  text: string;
  confidence?: number;
  provider: 'elevenlabs';
  noSpeech?: boolean;
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
  roundAwards?: MatchRoundAwardEvent[];
}

export interface MatchRoundAwardEvent {
  playerId: string;
  playerName: string;
  medalIds: string[];
  levelUps: number[];
  xpAfter: number;
  levelAfter: number;
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
