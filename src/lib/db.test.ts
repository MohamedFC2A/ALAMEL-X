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
});
