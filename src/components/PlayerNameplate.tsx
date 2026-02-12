import type { PlayerProgression } from '../types';
import { LevelBadge } from './LevelBadge';
import { PlayerMedalStrip } from './PlayerMedalStrip';

interface PlayerNameplateProps {
  name: string;
  progression?: PlayerProgression;
  isAi?: boolean;
  showMedals?: boolean;
  compact?: boolean;
  className?: string;
}

export function PlayerNameplate({
  name,
  progression,
  isAi = false,
  showMedals = true,
  compact = false,
  className = '',
}: PlayerNameplateProps) {
  return (
    <div className={`player-nameplate ${compact ? 'player-nameplate--compact' : ''} ${className}`.trim()}>
      {showMedals ? <PlayerMedalStrip progression={progression} limit={3} /> : null}
      <div className="player-nameplate__row">
        <span className="player-nameplate__name">{name}</span>
        <LevelBadge progression={progression} compact />
        {isAi ? <span className="ai-badge ai-badge--small">AI</span> : null}
      </div>
    </div>
  );
}
