import type { PlayerProgression } from '../types';
import { countUnlockedMedals, getUnlockedMedalsForDisplay } from '../lib/player-progression';

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
            {medal.name}
          </span>
        ))
      ) : (
        <span className="medal-chip medal-chip--empty">بدون ميداليات</span>
      )}
      {hiddenCount > 0 ? <span className="medal-chip medal-chip--extra">+{hiddenCount}</span> : null}
    </div>
  );
}
