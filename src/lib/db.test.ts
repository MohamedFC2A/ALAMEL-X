import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeGlobalSettings } from './db';

describe('global settings normalization', () => {
  it('forces aiHumanSimulationEnabled to false when mode is not ultra', () => {
    const normalized = normalizeGlobalSettings({
      ...defaultSettings,
      aiHumanMode: 'natural',
      aiHumanSimulationEnabled: true,
    });

    expect(normalized.aiHumanSimulationEnabled).toBe(false);
  });

  it('keeps aiHumanSimulationEnabled true only with ultra mode', () => {
    const normalized = normalizeGlobalSettings({
      ...defaultSettings,
      aiHumanMode: 'ultra',
      aiHumanSimulationEnabled: true,
    });

    expect(normalized.aiHumanSimulationEnabled).toBe(true);
  });

  it('clamps display and timing settings to safe ranges', () => {
    const normalized = normalizeGlobalSettings({
      ...defaultSettings,
      uiScale: 5,
      animationSpeed: 0.01,
      discussionMinutes: 99,
      guessSeconds: 1,
      aiSilenceThresholdMs: 99_999,
      aiInterventionRestMs: 50,
    });

    expect(normalized.uiScale).toBe(1.2);
    expect(normalized.animationSpeed).toBe(0.5);
    expect(normalized.discussionMinutes).toBe(6);
    expect(normalized.guessSeconds).toBe(15);
    expect(normalized.aiSilenceThresholdMs).toBe(12000);
    expect(normalized.aiInterventionRestMs).toBe(4000);
  });
});
