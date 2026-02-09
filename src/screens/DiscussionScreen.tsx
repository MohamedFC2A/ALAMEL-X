import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { updateActiveMatch } from '../lib/game-repository';
import { useClockNow } from '../hooks/useClockNow';
import { nowMs } from '../lib/clock';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { useActiveMatch } from '../hooks/useActiveMatch';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameButton } from '../components/GameButton';

export function DiscussionScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeMatchState = useActiveMatch();
  const activeMatch = activeMatchState?.match ?? null;
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const now = useClockNow();
  const discussionMs = Math.max(60_000, (settings?.discussionMinutes ?? 3) * 60 * 1000);

  useEffect(() => {
    if (!activeMatchState) {
      return;
    }
    if (!activeMatch) {
      navigate('/');
      return;
    }

    if (activeMatch.match.status === 'resolution') {
      navigate('/play/resolution');
      return;
    }

    if (activeMatch.match.status === 'summary' || activeMatch.match.status === 'completed') {
      navigate('/play/summary');
    }
  }, [activeMatch, activeMatchState, navigate]);

  const remainingMs = Math.max(0, (activeMatch?.discussionEndsAt ?? 0) - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress = activeMatch?.discussionEndsAt
    ? Math.max(0, Math.min(100, (remainingMs / discussionMs) * 100))
    : 100;

  useEffect(() => {
    if (!activeMatch || activeMatch.match.status !== 'discussion' || remainingMs > 0) {
      return;
    }

    void (async () => {
      await updateActiveMatch({
        uiPhaseLabel: 'resolution',
        match: {
          ...activeMatch.match,
          status: 'resolution',
        },
        resolutionStage: 'vote',
      });
      navigate('/play/resolution');
    })();
  }, [activeMatch, navigate, remainingMs]);

  if (!activeMatch) {
    return null;
  }

  async function startDiscussion() {
    const current = await db.activeMatch.get('active');
    if (!current) {
      return;
    }

    await updateActiveMatch({
      uiPhaseLabel: 'discussion',
      match: {
        ...current.match,
        status: 'discussion',
      },
      discussionEndsAt: nowMs() + discussionMs,
    });
  }

  async function skipDiscussion() {
    const current = await db.activeMatch.get('active');
    if (!current) {
      return;
    }

    await updateActiveMatch({
      uiPhaseLabel: 'resolution',
      match: {
        ...current.match,
        status: 'resolution',
      },
      resolutionStage: 'vote',
    });
    navigate('/play/resolution');
  }

  return (
    <ScreenScaffold title={t('discussion')} subtitle={t('discussionSubtitle')} eyebrow={t('phaseTalkEyebrow')}>
      <PhaseIndicator current={3} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />

      {activeMatch.match.status === 'ready' ? (
        <section className="glass-card phase-card section-card cinematic-panel">
          <h2>{t('closePhone')}</h2>
          <p className="subtle">{t('discussionStartHint')}</p>
          <GameButton variant="primary" size="lg" onClick={() => void startDiscussion()}>
            {t('startDiscussion')}
          </GameButton>
        </section>
      ) : (
        <section className="glass-card timer-card section-card cinematic-panel">
          <p className="eyebrow">{t('phaseTalk')}</p>
          <h2>
            {Math.floor(remainingSeconds / 60)
              .toString()
              .padStart(2, '0')}
            :
            {(remainingSeconds % 60).toString().padStart(2, '0')}
          </h2>
          <div className="progress-track" aria-hidden="true">
            <div className={`progress-fill${progress < 20 ? ' warning' : ''}`} style={{ width: `${progress}%` }} />
          </div>
        </section>
      )}

      <PrimaryActionBar>
        <GameButton variant="ghost" onClick={() => void skipDiscussion()}>
          {t('skipTimer')}
        </GameButton>
      </PrimaryActionBar>
    </ScreenScaffold>
  );
}
