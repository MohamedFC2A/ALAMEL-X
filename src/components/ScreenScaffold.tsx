import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';

interface ScreenScaffoldProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backHome?: boolean;
  children: ReactNode;
  className?: string;
}

export function ScreenScaffold({
  title,
  subtitle,
  eyebrow,
  backHome = true,
  children,
  className = '',
}: ScreenScaffoldProps) {
  const { t } = useTranslation();

  return (
    <main className={`screen-frame ${className}`.trim()}>
      <div className="screen-shell">
        <GlassCard className="screen-header cinematic-panel">
          <div className="header-rail">
            <div className="header-meta">
              {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
              {subtitle ? <p className="header-subtitle">{subtitle}</p> : null}
            </div>
            <div className="header-actions">
              <span className="case-badge">Case X</span>
              {backHome ? (
                <Link to="/" className="ghost-link header-home-link">
                  {t('home')}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="screen-header-main">
            <h1>{title}</h1>
          </div>
        </GlassCard>
        <section className="screen-scroll-region">{children}</section>
      </div>
    </main>
  );
}
