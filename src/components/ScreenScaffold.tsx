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
        <GlassCard className="screen-header">
          {/* Symmetric Grid: left / center / right */}
          <div className="header-grid">
            <div className="header-grid__start">
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            </div>
            <div className="header-grid__center">
              <h1>{title}</h1>
              {subtitle ? <p className="header-subtitle">{subtitle}</p> : null}
            </div>
            <div className="header-grid__end">
              {backHome ? (
                <Link to="/" className="ghost-link header-home-link">
                  {t('home')}
                </Link>
              ) : null}
            </div>
          </div>
        </GlassCard>
        <section className="screen-scroll-region">{children}</section>
      </div>
    </main>
  );
}
