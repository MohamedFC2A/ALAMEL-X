import { avatarById } from '../data/avatars';

interface PlayerAvatarProps {
  avatarId: string;
  alt: string;
  size?: number;
}

export function PlayerAvatar({ avatarId, alt, size = 48 }: PlayerAvatarProps) {
  const avatar = avatarById.get(avatarId) ?? avatarById.values().next().value;
  return (
    <img
      className="player-avatar"
      src={avatar?.src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
