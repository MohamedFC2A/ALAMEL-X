import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { db } from '../lib/db';
import { nextStatusAfterReveal, updateActiveMatch } from '../lib/game-repository';
import { nowMs } from '../lib/clock';
import { useClockNow } from '../hooks/useClockNow';
import type { Player } from '../types';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { useActiveMatch } from '../hooks/useActiveMatch';
import { formatWordForDisplay } from '../lib/word-format';

export function RevealScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const activeMatchState = useActiveMatch();
  const activeMatch = activeMatchState?.match ?? null;
  const players = useLiveQuery(() => db.players.toArray(), []);
  const [holding, setHolding] = useState(false);
  const [isRevealed, setRevealed] = useState(false);
  const [nextReadyAt, setNextReadyAt] = useState(0);
  const now = useClockNow(120);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    (players ?? []).forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const currentPlayer = activeMatch
    ? playerMap.get(activeMatch.match.playerIds[activeMatch.revealState.currentRevealIndex])
    : undefined;

  useEffect(() => {
    if (!activeMatchState) {
      return;
    }
    if (!activeMatch) {
      navigate('/');
      return;
    }

    if (activeMatch.match.status === 'ready' || activeMatch.match.status === 'discussion') {
      navigate('/play/discussion');
      return;
    }

    if (activeMatch.match.status === 'resolution') {
      navigate('/play/resolution');
      return;
    }
  }, [activeMatch, activeMatchState, navigate]);

  useEffect(() => {
    if (!holding || activeMatch?.revealState.phase !== 'reveal') {
      return;
    }

    const duration = (currentPlayer?.accessibility.extraReadMs ?? 1000) > 0 ? 650 : 500;
    const timer = window.setTimeout(() => {
      setRevealed(true);
      const readDelay = 700 + (currentPlayer?.accessibility.extraReadMs ?? 0);
      setNextReadyAt(nowMs() + readDelay);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [activeMatch?.revealState.phase, currentPlayer?.accessibility.extraReadMs, holding]);

  if (!activeMatch || !currentPlayer) {
    return null;
  }

  const currentMatch = activeMatch;
  const revealPlayer = currentPlayer;
  const isSpy = currentMatch.match.spyIds.includes(revealPlayer.id);
  const isLastPlayer = currentMatch.revealState.currentRevealIndex === currentMatch.match.playerIds.length - 1;
  const canMoveNext = isRevealed && now >= nextReadyAt && !currentMatch.transitionLock;
  const revealClass = [
    revealPlayer.accessibility.shortSightedMode ? 'access-magnify' : '',
    revealPlayer.accessibility.longSightedMode ? 'access-long' : '',
    revealPlayer.accessibility.highContrast ? 'access-contrast' : '',
    revealPlayer.accessibility.blurReduction ? 'access-blur-reduced' : '',
  ]
    .filter(Boolean)
    .join(' ');

  async function safePatch(patch: Parameters<typeof updateActiveMatch>[0]) {
    if (currentMatch.transitionLock) {
      return;
    }
    await updateActiveMatch({ transitionLock: true });
    await updateActiveMatch(patch);
    await updateActiveMatch({ transitionLock: false });
  }

  async function goBack() {
    if (currentMatch.revealState.phase !== 'reveal') {
      return;
    }

    setRevealed(false);
    setHolding(false);
    setNextReadyAt(0);
    await safePatch({
      revealState: {
        ...currentMatch.revealState,
        phase: 'handoff',
        canBack: false,
      },
    });
  }

  async function goToReveal() {
    await safePatch({
      revealState: {
        ...currentMatch.revealState,
        phase: 'reveal',
        canBack: true,
      },
    });
  }

  function handleHoldStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    setHolding(true);
  }

  function handleHoldEnd(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    setHolding(false);
  }

  async function goNext() {
    if (!canMoveNext) {
      return;
    }

    const revealedPlayerIds = Array.from(new Set([...currentMatch.revealState.revealedPlayerIds, revealPlayer.id]));

    if (isLastPlayer) {
      await safePatch({
        uiPhaseLabel: 'discussion',
        match: {
          ...currentMatch.match,
          status: nextStatusAfterReveal(true),
        },
        revealState: {
          ...currentMatch.revealState,
          revealedPlayerIds,
          canBack: true,
        },
      });
      navigate('/play/discussion');
      return;
    }

    await safePatch({
      match: {
        ...currentMatch.match,
        status: nextStatusAfterReveal(false),
      },
      revealState: {
        ...currentMatch.revealState,
        currentRevealIndex: currentMatch.revealState.currentRevealIndex + 1,
        revealedPlayerIds,
        phase: 'handoff',
        canBack: false,
      },
    });

    setRevealed(false);
    setHolding(false);
    setNextReadyAt(0);
  }

  return (
    <ScreenScaffold
      title={t('roleHeader')}
      subtitle={t('handoff', { name: revealPlayer.name })}
      eyebrow={t('phaseRevealEyebrow')}
    >
      <PhaseIndicator current={2} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />
      <section className="reveal-stage-hud panel-grid glass-card">
        <div className="metric-chip">
          <strong>{currentMatch.revealState.currentRevealIndex + 1}</strong>
          <span>{t('players')}</span>
        </div>
        <div className="metric-chip">
          <strong>{currentMatch.match.playerIds.length}</strong>
          <span>{t('selectedCount')}</span>
        </div>
      </section>

      {currentMatch.revealState.phase === 'handoff' ? (
        <section className="glass-card handoff-card section-card cinematic-panel">
          <PlayerAvatar avatarId={revealPlayer.avatarId} alt={revealPlayer.name} size={104} />
          <h2>{t('handoff', { name: revealPlayer.name })}</h2>
          <p className="subtle">{t('handoffSafetyNote')}</p>
          <button type="button" className="primary-btn" onClick={() => void goToReveal()}>
            {t('continue')}
          </button>
        </section>
      ) : (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`glass-card reveal-card section-card ${revealClass}`.trim()}>
          <div className="reveal-mask-wrapper">
            <div className="reveal-content">
              {isSpy ? (
                <div className="reveal-meta">
                  <h2 className="role-title role-title-spy">{t('roleSpy')}</h2>
                  <p className="spy-category">{t('category')}: {currentMatch.match.category}</p>
                  <p className="spy-hint">{t('hint')}: {i18n.language === 'ar' ? currentMatch.spyHintAr : currentMatch.spyHintEn}</p>
                </div>
              ) : (
                <div className="reveal-meta">
                  <h2 className="role-title role-title-citizen">{t('roleCitizen')}</h2>
                  <p>{t('secretWord')}</p>
                  <strong className="word-display">{formatWordForDisplay(i18n.language === 'ar' ? currentMatch.wordTextAr : currentMatch.wordTextEn, i18n.language as 'en' | 'ar')}</strong>
                </div>
              )}
            </div>
            {!isRevealed ? (
              <button
                type="button"
                className={`reveal-mask ${holding ? 'holding' : ''}`}
                onPointerDown={handleHoldStart}
                onPointerUp={handleHoldEnd}
                onPointerLeave={handleHoldEnd}
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
              >
                {t('pressHoldReveal')}
              </button>
            ) : null}
          </div>

          {!canMoveNext && isRevealed ? (
            <p className="cooldown-text">
              {t('revealReadyIn', {
                seconds: Math.max(1, Math.ceil((nextReadyAt - now) / 1000)),
              })}
            </p>
          ) : null}
        </motion.section>
      )}

      <PrimaryActionBar
        leading={
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void goBack()}
            disabled={currentMatch.revealState.phase === 'handoff'}
          >
            {t('back')}
          </button>
        }
      >
        {currentMatch.revealState.phase === 'reveal' ? (
          <button type="button" className="primary-btn next-btn" onClick={() => void goNext()} disabled={!canMoveNext}>
            {t('next')}
          </button>
        ) : (
          <div className="subtle">{t('safeTransitionHint')}</div>
        )}
      </PrimaryActionBar>
    </ScreenScaffold>
  );
}
