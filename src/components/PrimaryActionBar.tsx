import type { ReactNode } from 'react';

interface PrimaryActionBarProps {
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PrimaryActionBar({ leading, children, className = '' }: PrimaryActionBarProps) {
  return (
    <div className={`primary-action-bar glass-card ${className}`.trim()}>
      {leading ? <div className="action-leading">{leading}</div> : null}
      <div className="action-main">{children}</div>
    </div>
  );
}
