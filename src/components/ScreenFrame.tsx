import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ScreenFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backTo?: string;
}

export function ScreenFrame({ title, subtitle, children, backTo = '/' }: ScreenFrameProps) {
  return (
    <main className="screen-frame">
      <header className="screen-header glass-card">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <Link to={backTo} className="ghost-link">
          الرئيسية
        </Link>
      </header>
      {children}
    </main>
  );
}
