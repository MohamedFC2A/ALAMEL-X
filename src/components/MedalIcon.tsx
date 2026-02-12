import { useId } from 'react';
import type { MedalTier } from '../types';

interface MedalIconProps {
  tier: MedalTier;
  size?: number;
  className?: string;
}

export function MedalIcon({ tier, size = 18, className = '' }: MedalIconProps) {
  const uid = useId();
  const gid = `mg-${uid}`;

  if (tier === 'bronze') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill={`url(#${gid})`} stroke="#cd7f32" strokeWidth="1.2"/>
        <path d="M9 1.5h6l-1 3H10l-1-3z" fill="#cd7f32" opacity="0.7"/>
        <path d="M12 6.5l1.5 2.5h-3L12 6.5z" fill="#fff" opacity="0.3"/>
        <text x="12" y="12.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#fff3e0" fontFamily="var(--font-hud)">B</text>
        <defs>
          <radialGradient id={gid} cx="0.4" cy="0.35"><stop offset="0%" stopColor="#e8a44a"/><stop offset="100%" stopColor="#8b5a1e"/></radialGradient>
        </defs>
      </svg>
    );
  }

  if (tier === 'silver') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill={`url(#${gid})`} stroke="#b8c4d2" strokeWidth="1.2"/>
        <path d="M9 1.5h6l-1 3H10l-1-3z" fill="#b8c4d2" opacity="0.7"/>
        <path d="M8 17l4 5 4-5" fill="#b8c4d2" opacity="0.4"/>
        <text x="12" y="12.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#f1f7ff" fontFamily="var(--font-hud)">S</text>
        <defs>
          <radialGradient id={gid} cx="0.4" cy="0.35"><stop offset="0%" stopColor="#d4dce8"/><stop offset="100%" stopColor="#6b7a8d"/></radialGradient>
        </defs>
      </svg>
    );
  }

  if (tier === 'gold') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill={`url(#${gid})`} stroke="#ffc64f" strokeWidth="1.4"/>
        <path d="M9 1.5h6l-1 3H10l-1-3z" fill="#ffc64f" opacity="0.8"/>
        <path d="M8 17l4 5 4-5" fill="#ffc64f" opacity="0.5"/>
        <path d="M12 6l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 12l-2.3 1.2.5-2.6-1.9-1.8 2.6-.4L12 6z" fill="#fff" opacity="0.15"/>
        <text x="12" y="12.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#fff8dc" fontFamily="var(--font-hud)">G</text>
        <defs>
          <radialGradient id={gid} cx="0.4" cy="0.35"><stop offset="0%" stopColor="#ffe070"/><stop offset="100%" stopColor="#a06d20"/></radialGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="10" r="7" fill={`url(#${gid})`} stroke="#ff7043" strokeWidth="1.4"/>
      <path d="M9 1h6l-1 3.5H10L9 1z" fill="#ff7043" opacity="0.8"/>
      <path d="M8 17l4 5.5 4-5.5" fill="#ff7043" opacity="0.5"/>
      <path d="M7.5 17l4.5 5.5 4.5-5.5" fill="#ff5722" opacity="0.3"/>
      <path d="M12 5.5l1.8 2.8 3 .6-2.2 2.1.5 3L12 12.5 8.9 14l.5-3-2.2-2.1 3-.6L12 5.5z" fill="#fff" opacity="0.12"/>
      <text x="12" y="12.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#ffd9c9" fontFamily="var(--font-hud)">M</text>
      <defs>
        <radialGradient id={gid} cx="0.4" cy="0.35"><stop offset="0%" stopColor="#ff8a65"/><stop offset="100%" stopColor="#bf360c"/></radialGradient>
      </defs>
    </svg>
  );
}
