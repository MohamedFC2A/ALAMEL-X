import type { CSSProperties } from 'react';
import type { PlayerProgression } from '../types';
import { ensureProgressionState, getLevelThreshold, getNextLevelThreshold } from '../lib/player-progression';

interface LevelBadgeProps {
  progression?: PlayerProgression;
  compact?: boolean;
  showXp?: boolean;
  className?: string;
}

function getFireTier(level: number): string {
  if (level >= 50) return 'level-chip--legendary';
  if (level >= 35) return 'level-chip--mythic-fire';
  if (level >= 20) return 'level-chip--inferno';
  if (level >= 10) return 'level-chip--flame';
  if (level >= 5) return 'level-chip--ember';
  return '';
}

function getFireStyle(level: number): CSSProperties | undefined {
  if (level < 5) return undefined;

  const t = Math.min(level, 50);
  const norm = (t - 5) / 45;

  return {
    '--fire-intensity': norm,
    '--fire-glow': Math.min(0.95, 0.15 + norm * 0.8),
    '--fire-speed': `${Math.max(0.4, 1.6 - norm * 1.2)}s`,
    '--fire-scale': 1 + norm * 0.08,
    '--fire-spread': `${4 + norm * 22}px`,
  } as CSSProperties;
}

export function LevelBadge({ progression, compact = false, showXp = false, className = '' }: LevelBadgeProps) {
  const state = ensureProgressionState(progression);
  const level = state.level;
  const nextThreshold = getNextLevelThreshold(level);
  const currentThreshold = getLevelThreshold(level);
  const progress =
    nextThreshold && nextThreshold > currentThreshold
      ? Math.max(0, Math.min(1, (state.xp - currentThreshold) / (nextThreshold - currentThreshold)))
      : 1;

  const tierClass = getFireTier(level);
  const fireStyle = getFireStyle(level);

  return (
    <div className={`level-badge ${compact ? 'level-badge--compact' : ''} ${className}`.trim()}>
      <span className={`level-chip ${tierClass}`.trim()} style={fireStyle}>{`Lv.${level}`}</span>
      {showXp ? (
        <span className="level-xp">
          {nextThreshold ? `${state.xp}/${nextThreshold}` : `${state.xp}/MAX`}
        </span>
      ) : null}
      {showXp ? (
        <span className="level-progress" aria-hidden>
          <span className="level-progress__fill" style={{ transform: `scaleX(${progress})` }} />
        </span>
      ) : null}
    </div>
  );
}
