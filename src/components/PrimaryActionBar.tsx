import type { ReactNode } from 'react';

interface PrimaryActionBarProps {
  leading?: ReactNode;
  children: ReactNode;
}

export function PrimaryActionBar({ leading, children }: PrimaryActionBarProps) {
  return (
    <div className="primary-action-bar glass-card">
      {leading ? <div className="action-leading">{leading}</div> : null}
      <div className="action-main">{children}</div>
    </div>
  );
}
