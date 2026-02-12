import type { PlayerProgression } from '../types';
import { countUnlockedMedals, getUnlockedMedalsForDisplay } from '../lib/player-progression';
import { MedalIcon } from './MedalIcon';

interface PlayerMedalStripProps {
  progression?: PlayerProgression;
  limit?: number;
  className?: string;
}

export function PlayerMedalStrip({ progression, limit = 5, className = '' }: PlayerMedalStripProps) {
  const medals = getUnlockedMedalsForDisplay(progression, limit);
  const totalCount = countUnlockedMedals(progression);
  const hiddenCount = Math.max(0, totalCount - medals.length);

  return (
    <div className={`medal-strip ${className}`.trim()}>
      {medals.length > 0 ? (
        medals.map((medal) => (
          <span key={medal.id} className={`medal-chip medal-chip--${medal.tier}`.trim()} title={medal.name}>
            <MedalIcon tier={medal.tier} size={16} />
            <span className="medal-chip__label">{medal.name}</span>
          </span>
        ))
      ) : (
        <span className="medal-chip medal-chip--empty">-</span>
      )}
      {hiddenCount > 0 ? <span className="medal-chip medal-chip--extra">+{hiddenCount}</span> : null}
    </div>
  );
}
