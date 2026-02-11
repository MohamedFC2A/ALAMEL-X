import { describe, expect, it } from 'vitest';
import { defaultSettings } from './db';
import { analyzeUiHealth, resolveAutoUiScale } from './ui-self-heal';

describe('ui self-heal diagnostics', () => {
  it('suggests compact layout and smaller scale on very narrow screens', () => {
    const result = analyzeUiHealth(defaultSettings, {
      viewportWidth: 340,
      viewportHeight: 700,
      devicePixelRatio: 3,
      rootFontSizePx: 16,
      prefersReducedMotion: false,
      horizontalOverflowPx: 0,
      headerOverflowPx: 0,
      headerTitleTruncated: false,
      actionBarBottomOverlapPx: 0,
      touchTargetRiskCount: 0,
    });

    expect(result.report.issues.length).toBeGreaterThan(0);
    expect(result.patch.uiDensity).toBe('compact');
    expect(result.patch.uiScale).toBeLessThan(1);
    expect(result.report.score).toBeLessThan(100);
  });

  it('enables reduced motion when system preference requires it', () => {
    const result = analyzeUiHealth(
      {
        ...defaultSettings,
        reducedMotionMode: false,
        animationSpeed: 1.3,
      },
      {
        viewportWidth: 420,
        viewportHeight: 860,
        devicePixelRatio: 2,
        rootFontSizePx: 16,
        prefersReducedMotion: true,
        horizontalOverflowPx: 0,
        headerOverflowPx: 0,
        headerTitleTruncated: false,
        actionBarBottomOverlapPx: 0,
        touchTargetRiskCount: 0,
      },
    );

    expect(result.patch.reducedMotionMode).toBe(true);
    expect(result.patch.animationSpeed).toBeLessThan(1.3);
  });

  it('returns no patch when layout is healthy', () => {
    const result = analyzeUiHealth(defaultSettings, {
      viewportWidth: 430,
      viewportHeight: 820,
      devicePixelRatio: 2,
      rootFontSizePx: 16,
      prefersReducedMotion: false,
      horizontalOverflowPx: 0,
      headerOverflowPx: 0,
      headerTitleTruncated: false,
      actionBarBottomOverlapPx: 0,
      touchTargetRiskCount: 0,
    });

    expect(result.report.issues).toEqual([]);
    expect(result.patch).toEqual({});
    expect(result.report.score).toBe(100);
  });

  it('applies stronger correction when action bar overlaps viewport', () => {
    const result = analyzeUiHealth(defaultSettings, {
      viewportWidth: 390,
      viewportHeight: 590,
      devicePixelRatio: 2,
      rootFontSizePx: 16,
      prefersReducedMotion: false,
      horizontalOverflowPx: 0,
      headerOverflowPx: 0,
      headerTitleTruncated: false,
      actionBarBottomOverlapPx: 12,
      touchTargetRiskCount: 0,
    });

    expect(result.report.issues.some((issue) => issue.code === 'action-bar-overlap')).toBe(true);
    expect(result.patch.uiDensity).toBe('compact');
    expect(result.patch.uiScale).toBeLessThan(1);
  });

  it('computes lower auto scale for narrow high-density phones', () => {
    const autoScale = resolveAutoUiScale(
      {
        viewportWidth: 360,
        viewportHeight: 640,
        devicePixelRatio: 3,
      },
      defaultSettings,
    );

    expect(autoScale).toBeLessThan(1);
    expect(autoScale).toBeGreaterThan(0.84);
  });

  it('computes slightly larger auto scale for wide desktop layouts', () => {
    const autoScale = resolveAutoUiScale(
      {
        viewportWidth: 1366,
        viewportHeight: 768,
        devicePixelRatio: 1,
      },
      defaultSettings,
    );

    expect(autoScale).toBeGreaterThan(1);
    expect(autoScale).toBeLessThanOrEqual(1.12);
  });
});
