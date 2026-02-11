import type { CSSProperties } from 'react';
import type { PlayerProgression } from '../types';
import { ensureProgressionState, getLevelThreshold, getNextLevelThreshold } from '../lib/player-progression';

interface LevelBadgeProps {
  progression?: PlayerProgression;
  compact?: boolean;
  showXp?: boolean;
  className?: string;
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

  const levelClass = level >= 20 ? 'level-chip--inferno' : level >= 10 ? 'level-chip--gold' : '';
  const infernoIntensity = Math.max(0, level - 20);
  const infernoStep = Math.min(18, infernoIntensity);
  const levelStyle: CSSProperties | undefined =
    level >= 20
      ? ({
          '--inferno-intensity': infernoStep,
          '--inferno-glow-alpha': Math.min(0.9, 0.48 + infernoStep * 0.02),
          '--inferno-speed': `${Math.max(0.6, 1.3 - infernoStep * 0.03)}s`,
          '--inferno-flame-opacity': Math.min(0.97, 0.86 + infernoStep * 0.006),
        } as CSSProperties)
      : undefined;

  return (
    <div className={`level-badge ${compact ? 'level-badge--compact' : ''} ${className}`.trim()}>
      <span className={`level-chip ${levelClass}`.trim()} style={levelStyle}>{`Lv.${level}`}</span>
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
