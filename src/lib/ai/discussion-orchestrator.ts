import type { Player } from '../../types';

export const DEFAULT_SILENCE_THRESHOLD_MS = 6_000;
export const DEFAULT_POST_QUESTION_ANSWER_WINDOW_MS = 7_000;

export interface ShouldTriggerSilenceParams {
  now: number;
  lastInterventionAt: number;
  lastVoiceActivityAt: number;
  silenceThresholdMs: number;
  cooldownMs: number;
  hasPendingTarget: boolean;
  processing: boolean;
  speaking: boolean;
}

export function shouldTriggerSilenceIntervention(params: ShouldTriggerSilenceParams): boolean {
  if (params.processing || params.speaking || params.hasPendingTarget) {
    return false;
  }

  const silenceFor = params.now - params.lastVoiceActivityAt;
  if (silenceFor < Math.max(1_000, params.silenceThresholdMs)) {
    return false;
  }

  const sinceIntervention = params.now - params.lastInterventionAt;
  if (sinceIntervention < Math.max(1_500, params.cooldownMs)) {
    return false;
  }

  return true;
}

export interface PickTargetParams {
  activeAiId: string;
  participants: Array<Pick<Player, 'id'>>;
  suspicionScoreByPlayerId: Record<string, number>;
  cursor: number;
}

export interface PickTargetResult {
  targetPlayerId: string | null;
  nextCursor: number;
}

export function pickNextTargetPlayerId(params: PickTargetParams): PickTargetResult {
  const candidates = params.participants.filter((player) => player.id !== params.activeAiId);
  if (!candidates.length) {
    return { targetPlayerId: null, nextCursor: 0 };
  }

  const ranked = [...candidates].sort((left, right) => {
    const scoreDiff = (params.suspicionScoreByPlayerId[right.id] ?? 0) - (params.suspicionScoreByPlayerId[left.id] ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.id.localeCompare(right.id);
  });

  const topScore = params.suspicionScoreByPlayerId[ranked[0].id] ?? 0;
  if (topScore >= 2.5) {
    return {
      targetPlayerId: ranked[0].id,
      nextCursor: params.cursor,
    };
  }

  const normalizedCursor = Math.abs(params.cursor) % candidates.length;
  const pick = candidates[normalizedCursor];
  return {
    targetPlayerId: pick.id,
    nextCursor: (normalizedCursor + 1) % candidates.length,
  };
}

export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[\u064b-\u065f\u0610-\u061a\u06d6-\u06ed]/g, '')
    .replace(/[^\p{L}\p{N}\s؟?]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isYesNoQuestion(text: string): boolean {
  const normalized = normalizeSpeechText(text);
  if (!normalized) {
    return false;
  }

  if (/[؟?]\s*$/.test(text.trim()) && /(هل|هو|هي|can|is|are|did|do)/i.test(normalized)) {
    return true;
  }

  const binaryPatterns = [
    /(^|\s)هل(\s|$)/u,
    /(^|\s)مش(\s|$).+(\s|^)ولا(\s|$)/u,
    /(^|\s)صح(\s|$).+(\s|^)ولا(\s|$)/u,
    /\btrue\b.+\bor\b.+\bfalse\b/i,
    /\byes\b.+\bor\b.+\bno\b/i,
    /(^|\s)ينفع(\s|$)/u,
    /(^|\s)ممكن(\s|$)/u,
    /(^|\s)يؤكل(\s|$)/u,
  ];

  return binaryPatterns.some((pattern) => pattern.test(normalized));
}

export function scoreSuspicionFromTranscript(text: string): number {
  const normalized = normalizeSpeechText(text);
  if (!normalized) {
    return 0;
  }

  let score = 0;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length <= 2) score += 0.6;
  if (/(مش عارف|مش متاكد|يمكن|تقريبا|مش فاكر|مش واضح)/u.test(normalized)) score += 1.25;
  if (/(^|\s)(اه|ايوه|لا)(\s|$)/u.test(normalized) && words.length <= 4) score += 0.45;
  return score;
}

export function asNamedLine(name: string, text: string): string {
  const safeName = name.replace(/\s+/g, ' ').trim();
  const safeText = text.replace(/\s+/g, ' ').trim();
  return `${safeName}: ${safeText}`;
}
