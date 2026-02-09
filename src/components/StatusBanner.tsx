import type { ReactNode } from 'react';

interface StatusBannerProps {
  children: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  className?: string;
}

export function StatusBanner({ children, tone = 'default', className = '' }: StatusBannerProps) {
  return <div className={`status-banner tone-${tone} ${className}`.trim()}>{children}</div>;
}
