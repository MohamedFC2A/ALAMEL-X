import { describe, expect, it } from 'vitest';
import {
  asNamedLine,
  classifyUtterance,
  isYesNoQuestion,
  pickNextTargetPlayerId,
  scoreSuspicionFromTranscript,
  shouldTriggerSilenceIntervention,
} from './discussion-orchestrator';

describe('discussion orchestrator helpers', () => {
  it('triggers silence intervention after threshold and cooldown', () => {
    const shouldTrigger = shouldTriggerSilenceIntervention({
      now: 18_000,
      lastInterventionAt: 9_000,
      lastVoiceActivityAt: 11_500,
      silenceThresholdMs: 6_000,
      cooldownMs: 2_000,
      hasPendingTarget: false,
      processing: false,
      speaking: false,
    });

    expect(shouldTrigger).toBe(true);
  });

  it('does not trigger when waiting on a pending target', () => {
    const shouldTrigger = shouldTriggerSilenceIntervention({
      now: 24_000,
      lastInterventionAt: 9_000,
      lastVoiceActivityAt: 11_500,
      silenceThresholdMs: 6_000,
      cooldownMs: 2_000,
      hasPendingTarget: true,
      processing: false,
      speaking: false,
    });

    expect(shouldTrigger).toBe(false);
  });

  it('picks highest suspicion target when suspicion is high', () => {
    const result = pickNextTargetPlayerId({
      activeAiId: 'ai1',
      participants: [{ id: 'ai1' }, { id: 'p1' }, { id: 'p2' }],
      suspicionScoreByPlayerId: { p1: 3.2, p2: 0.5 },
      cursor: 0,
    });

    expect(result.targetPlayerId).toBe('p1');
  });

  it('falls back to round-robin when suspicion is low', () => {
    const result = pickNextTargetPlayerId({
      activeAiId: 'ai1',
      participants: [{ id: 'ai1' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      suspicionScoreByPlayerId: { p1: 0.4, p2: 0.6, p3: 0.2 },
      cursor: 1,
    });

    expect(result.targetPlayerId).toBe('p2');
    expect(result.nextCursor).toBe(2);
  });

  it('detects yes/no questions in Arabic', () => {
    expect(isYesNoQuestion('هل ده الشيء ده يؤكل؟')).toBe(true);
    expect(isYesNoQuestion('قول وصف بسيط للمكان')).toBe(false);
  });

  it('scores suspicious transcript patterns', () => {
    const higher = scoreSuspicionFromTranscript('مش عارف بصراحة');
    const lower = scoreSuspicionFromTranscript('المكان واسع وفيه ضوضاء');
    expect(higher).toBeGreaterThan(lower);
  });

  it('formats transcript lines with speaker name', () => {
    expect(asNamedLine('محمد', 'مش متأكد')).toBe('محمد: مش متأكد');
  });

  it('classifies directed ai questions correctly', () => {
    const result = classifyUtterance('يا العميل صقر هل المكان ده مغلق؟', {
      activeAiName: 'العميل صقر',
      pendingTargetName: 'محمد',
    });

    expect(result.kind).toBe('question');
    expect(result.addressedToAi).toBe(true);
    expect(result.expectsReplyFromAi).toBe(true);
    expect(result.isBinaryQuestion).toBe(true);
  });

  it('classifies short direct responses as answers', () => {
    const result = classifyUtterance('أه غالبًا', {
      activeAiName: 'العميل صقر',
      pendingTargetName: 'محمد',
    });

    expect(result.kind).toBe('answer');
    expect(result.expectsReplyFromAi).toBe(false);
  });
});
