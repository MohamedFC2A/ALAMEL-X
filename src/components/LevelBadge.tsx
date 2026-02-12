import type { CSSProperties } from 'react';
import type { PlayerProgression } from '../types';
import { ensureProgressionState, getLevelThreshold, getNextLevelThreshold } from '../lib/player-progression';

interface LevelBadgeProps {
  progression?: PlayerProgression;
  compact?: boolean;
  showXp?: boolean;
  className?: string;
}

function getFireTier(level: number): { className: string; particleCount: number } {
  if (level >= 50) return { className: 'fire-legendary', particleCount: 14 };
  if (level >= 35) return { className: 'fire-mythic', particleCount: 11 };
  if (level >= 20) return { className: 'fire-inferno', particleCount: 8 };
  if (level >= 10) return { className: 'fire-flame', particleCount: 6 };
  if (level >= 5) return { className: 'fire-ember', particleCount: 4 };
  return { className: '', particleCount: 0 };
}

function getFireVars(level: number): CSSProperties | undefined {
  if (level < 5) return undefined;
  const t = Math.min(level, 50);
  const norm = (t - 5) / 45;
  return {
    '--fire-intensity': norm,
    '--fire-speed': `${Math.max(0.35, 1.6 - norm * 1.25)}s`,
    '--fire-height': `${8 + norm * 28}px`,
    '--fire-glow-size': `${4 + norm * 24}px`,
    '--fire-glow-opacity': 0.2 + norm * 0.7,
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

  const { className: tierClass, particleCount } = getFireTier(level);
  const fireVars = getFireVars(level);

  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push(
      <span
        key={i}
        className="fire-particle"
        style={{ '--p-i': i, '--p-total': particleCount } as CSSProperties}
        aria-hidden
      />
    );
  }

  return (
    <div className={`level-badge ${compact ? 'level-badge--compact' : ''} ${className}`.trim()}>
      <span className={`level-chip ${tierClass}`.trim()} style={fireVars}>
        {tierClass && <span className="fire-glow-ring" aria-hidden />}
        {particles.length > 0 && <span className="fire-particles" aria-hidden>{particles}</span>}
        <span className="level-chip__text">{`Lv.${level}`}</span>
      </span>
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
