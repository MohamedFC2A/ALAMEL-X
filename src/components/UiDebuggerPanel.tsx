import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GlobalSettings } from '../types';
import { useUiDebugger } from '../hooks/useUiDebugger';
import { GameButton } from './GameButton';
import { StatusBanner } from './StatusBanner';

interface UiDebuggerPanelProps {
  settings: GlobalSettings;
}

export function UiDebuggerPanel({ settings }: UiDebuggerPanelProps) {
  const { t, i18n } = useTranslation();
  const [lastRunAt, setLastRunAt] = useState(0);
  const { snapshot, events, eventCount, copyStatus, runDiagnostics, copySnapshot, clearRuntimeErrors } = useUiDebugger(settings);

  const recentEvents = useMemo(() => events.slice(-6).reverse(), [events]);

  const handleRunDiagnostics = () => {
    const next = runDiagnostics();
    if (!next) {
      return;
    }
    setLastRunAt(next.at);
  };

  return (
    <section className="ui-debugger-panel">
      <div className="section-heading section-heading--stack">
        <h3>{t('uiDebuggerTitle')}</h3>
        <span className="subtle">{t('uiDebuggerHint')}</span>
      </div>

      <div className="actions-row ui-debugger-actions">
        <GameButton variant="primary" size="md" onClick={handleRunDiagnostics}>
          {t('uiDebuggerRun')}
        </GameButton>
        <GameButton variant="ghost" size="md" onClick={() => void copySnapshot()}>
          {t('uiDebuggerCopy')}
        </GameButton>
        <GameButton variant="ghost" size="md" onClick={clearRuntimeErrors}>
          {t('uiDebuggerClear')}
        </GameButton>
      </div>

      {copyStatus === 'success' ? (
        <StatusBanner tone="success">{t('uiDebuggerCopyDone')}</StatusBanner>
      ) : copyStatus === 'error' ? (
        <StatusBanner tone="danger">{t('uiDebuggerCopyFail')}</StatusBanner>
      ) : null}

      {snapshot ? (
        <div className="ui-debugger-report">
          <StatusBanner tone={snapshot.report.score >= 85 ? 'success' : snapshot.report.score >= 65 ? 'warning' : 'danger'}>
            {t('uiSelfHealDone', { score: snapshot.report.score })}
          </StatusBanner>
          <p className="subtle">
            {t('uiDebuggerLastRoute', { route: snapshot.route })}
            {' | '}
            {t('uiDebuggerLastRunAt', {
              time: new Date(snapshot.at).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US'),
            })}
          </p>

          {snapshot.report.issues.length > 0 ? (
            <ul className="ui-debugger-list" aria-label={t('uiDebuggerIssuesLabel')}>
              {snapshot.report.issues.map((issue) => (
                <li key={`${issue.code}:${issue.weight}`}>
                  <strong>{issue.title}</strong>
                  <p>{issue.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <StatusBanner tone="success">{t('uiDebuggerNoIssues')}</StatusBanner>
          )}
        </div>
      ) : lastRunAt ? null : (
        <StatusBanner>{t('uiDebuggerRunHint')}</StatusBanner>
      )}

      <div className="ui-debugger-errors">
        <div className="section-heading">
          <h3>{t('uiDebuggerErrorsTitle')}</h3>
          <span className="section-count-badge">{eventCount}</span>
        </div>

        {recentEvents.length > 0 ? (
          <ul className="ui-debugger-list" aria-label={t('uiDebuggerErrorsLabel')}>
            {recentEvents.map((event) => (
              <li key={event.id}>
                <strong>
                  [{event.type}] {event.message}
                </strong>
                <p>
                  {event.route}
                  {' | '}
                  {new Date(event.at).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <StatusBanner tone="success">{t('uiDebuggerNoErrors')}</StatusBanner>
        )}
      </div>
    </section>
  );
}
