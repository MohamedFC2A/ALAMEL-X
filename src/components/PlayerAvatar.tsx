import { avatarById } from '../data/avatars';

interface PlayerAvatarProps {
  avatarId: string;
  alt: string;
  size?: number;
}

export function PlayerAvatar({ avatarId, alt, size = 48 }: PlayerAvatarProps) {
  const avatar = avatarById.get(avatarId) ?? avatarById.values().next().value;
  const isAi = avatarId === 'ai_bot';
  return (
    <div
      className={`player-avatar-wrap ${isAi ? 'player-avatar-wrap--ai' : ''}`}
      style={{ width: size, height: size }}
    >
      <img
        className="player-avatar"
        src={avatar?.src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
