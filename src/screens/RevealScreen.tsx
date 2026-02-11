import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { clamp } from '../lib/utils';
import { GameButton } from '../components/GameButton';
import { PlayerNameplate } from '../components/PlayerNameplate';
import { RestartRoundButton } from '../components/RestartRoundButton';
import {
  beginRevealHoldFeedback,
  cancelRevealHoldFeedback,
  completeRevealHoldFeedback,
  updateRevealHoldFeedback,
} from '../lib/ui-feedback';

type HoldPhase = 'idle' | 'holding' | 'revealed';

const HOLD_PROGRESS_TICK_MS = 16;
const HOLD_RELEASE_THRESHOLD = 0.7;

function computeHoldDurationMs(extraReadMs: number): number {
  return clamp(460 + Math.round(extraReadMs * 0.08), 430, 840);
}

function computeRevealReadyDelayMs(hintText: string, hasSpyTeammate: boolean, extraReadMs: number): number {
  const compactHintLength = hintText.replace(/\s+/g, '').length;
  const hintBonus = Math.min(1400, compactHintLength * 28);
  const teammateBonus = hasSpyTeammate ? 260 : 0;
  const accessibilityBonus = clamp(extraReadMs, 0, 1800);
  return clamp(920 + hintBonus + teammateBonus + accessibilityBonus, 1100, 4200);
}

export function RevealScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const activeMatchState = useActiveMatch();
  const activeMatch = activeMatchState?.match ?? null;
  const players = useLiveQuery(() => db.players.toArray(), []);
  const [holdPhase, setHoldPhase] = useState<HoldPhase>('idle');
  const [holdProgress, setHoldProgress] = useState(0);
  const [nextReadyAt, setNextReadyAt] = useState(0);
  const [nextUnlocked, setNextUnlocked] = useState(false);
  const now = useClockNow(120);
  const holdStartedAtRef = useRef(0);
  const holdDurationRef = useRef(computeHoldDurationMs(0));
  const holdIntervalRef = useRef<number | null>(null);
  const holdFinishTimerRef = useRef<number | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const holdProgressRef = useRef(0);
  const holdPhaseRef = useRef<HoldPhase>('idle');
  const aiSkipKeyRef = useRef('');
  const revealIndex = activeMatch?.revealState.currentRevealIndex ?? -1;
  const revealPhase = activeMatch?.revealState.phase ?? 'handoff';

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
    holdProgressRef.current = holdProgress;
  }, [holdProgress]);

  useEffect(() => {
    holdPhaseRef.current = holdPhase;
  }, [holdPhase]);

  const clearHoldTimers = useCallback(() => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdFinishTimerRef.current !== null) {
      window.clearTimeout(holdFinishTimerRef.current);
      holdFinishTimerRef.current = null;
    }
  }, []);

  const clearUnlockTimer = useCallback(() => {
    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  const resetRevealLocalState = useCallback(() => {
    clearHoldTimers();
    clearUnlockTimer();
    cancelRevealHoldFeedback();
    setHoldPhase('idle');
    setHoldProgress(0);
    setNextReadyAt(0);
    setNextUnlocked(false);
  }, [clearHoldTimers, clearUnlockTimer]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      resetRevealLocalState();
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [revealIndex, revealPhase, resetRevealLocalState]);

  useEffect(
    () => () => {
      clearHoldTimers();
      clearUnlockTimer();
      cancelRevealHoldFeedback();
    },
    [clearHoldTimers, clearUnlockTimer],
  );

  useEffect(() => {
    if (!activeMatch || !currentPlayer) {
      aiSkipKeyRef.current = '';
      return;
    }

    if (activeMatch.match.status !== 'reveal') {
      return;
    }

    if (currentPlayer.kind !== 'ai') {
      aiSkipKeyRef.current = '';
      return;
    }

    const key = `${activeMatch.match.id}:${activeMatch.revealState.currentRevealIndex}`;
    if (aiSkipKeyRef.current === key) {
      return;
    }

    aiSkipKeyRef.current = key;
    const aiPlayerId = currentPlayer.id;

    const timer = window.setTimeout(() => {
      void (async () => {
        const refreshed = await db.activeMatch.get('active');
        if (!refreshed || refreshed.match.status !== 'reveal') {
          return;
        }

        const refreshedPlayerId = refreshed.match.playerIds[refreshed.revealState.currentRevealIndex];
        if (!refreshedPlayerId || refreshedPlayerId !== aiPlayerId) {
          return;
        }

        const refreshedPlayer = playerMap.get(refreshedPlayerId);
        if (!refreshedPlayer || refreshedPlayer.kind !== 'ai') {
          return;
        }

        const revealedPlayerIds = Array.from(new Set([...refreshed.revealState.revealedPlayerIds, refreshedPlayerId]));
        const isLastPlayer = refreshed.revealState.currentRevealIndex >= refreshed.match.playerIds.length - 1;

        if (isLastPlayer) {
          await updateActiveMatch({
            uiPhaseLabel: 'discussion',
            match: {
              ...refreshed.match,
              status: nextStatusAfterReveal(true),
            },
            revealState: {
              ...refreshed.revealState,
              revealedPlayerIds,
              canBack: true,
            },
          });
          navigate('/play/discussion');
          return;
        }

        await updateActiveMatch({
          match: {
            ...refreshed.match,
            status: nextStatusAfterReveal(false),
          },
          revealState: {
            ...refreshed.revealState,
            currentRevealIndex: refreshed.revealState.currentRevealIndex + 1,
            revealedPlayerIds,
            phase: 'handoff',
            canBack: false,
          },
        });
      })();
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeMatch, currentPlayer, navigate, playerMap]);

  if (!activeMatch || !currentPlayer) {
    return null;
  }

  const currentMatch = activeMatch;
  const revealPlayer = currentPlayer;
  const isAiPlayer = revealPlayer.kind === 'ai';
  const isSpy = currentMatch.match.spyIds.includes(revealPlayer.id);
  const isRevealed = holdPhase === 'revealed';
  const spyHintText = i18n.language === 'ar' ? currentMatch.spyHintAr : currentMatch.spyHintEn;
  const citizenWord = formatWordForDisplay(
    i18n.language === 'ar' ? currentMatch.wordTextAr : currentMatch.wordTextEn,
    i18n.language as 'en' | 'ar',
  );
  const teammateNames = isSpy
    ? currentMatch.match.spyIds
      .filter((spyId) => spyId !== revealPlayer.id)
      .map((spyId) => playerMap.get(spyId)?.name ?? spyId)
    : [];
  const isLastPlayer = currentMatch.revealState.currentRevealIndex === currentMatch.match.playerIds.length - 1;
  const canMoveNext = isRevealed && nextUnlocked && now >= nextReadyAt && !currentMatch.transitionLock;
  const progressGlowShift = i18n.dir() === 'rtl' ? -Math.round(holdProgress * 100) : Math.round(holdProgress * 100);
  const holdProgressPercent = Math.round(holdProgress * 100);
  const holdHelperText =
    holdProgress < 0.35 ? t('holdSteady') : holdProgress < 0.8 ? t('holdAlmostThere') : t('holdReleaseNow');
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

  function finishReveal() {
    if (holdPhaseRef.current === 'revealed') {
      return;
    }

    clearHoldTimers();
    completeRevealHoldFeedback();
    setHoldProgress(1);
    setHoldPhase('revealed');

    const readDelay = computeRevealReadyDelayMs(
      isSpy ? spyHintText : '',
      teammateNames.length > 0,
      revealPlayer.accessibility.extraReadMs ?? 0,
    );

    setNextUnlocked(false);
    setNextReadyAt(nowMs() + readDelay);
    clearUnlockTimer();
    unlockTimerRef.current = window.setTimeout(() => {
      setNextUnlocked(true);
    }, readDelay);
  }

  function resetHoldOnly() {
    clearHoldTimers();
    cancelRevealHoldFeedback();
    setHoldPhase('idle');
    setHoldProgress(0);
  }

  async function goBack() {
    if (currentMatch.revealState.phase !== 'reveal') {
      return;
    }

    resetRevealLocalState();
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
    if (currentMatch.revealState.phase !== 'reveal' || holdPhaseRef.current === 'revealed') {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const holdDuration = computeHoldDurationMs(revealPlayer.accessibility.extraReadMs ?? 0);
    holdDurationRef.current = holdDuration;
    resetHoldOnly();
    setHoldPhase('holding');
    holdStartedAtRef.current = nowMs();
    beginRevealHoldFeedback();

    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = nowMs() - holdStartedAtRef.current;
      const progress = clamp(elapsed / holdDuration, 0, 1);
      updateRevealHoldFeedback(progress);
      setHoldProgress(progress);
      if (progress >= 1) {
        finishReveal();
      }
    }, HOLD_PROGRESS_TICK_MS);

    holdFinishTimerRef.current = window.setTimeout(() => {
      setHoldProgress(1);
      finishReveal();
    }, holdDuration + HOLD_PROGRESS_TICK_MS);
  }

  function handleHoldEnd(event: React.PointerEvent<HTMLButtonElement>) {
    if (holdPhaseRef.current !== 'holding') {
      return;
    }
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const elapsed = nowMs() - holdStartedAtRef.current;
    const releasedProgress = clamp(elapsed / holdDurationRef.current, 0, 1);
    holdProgressRef.current = releasedProgress;
    setHoldProgress(releasedProgress);
    updateRevealHoldFeedback(releasedProgress);
    if (releasedProgress >= HOLD_RELEASE_THRESHOLD) {
      finishReveal();
      return;
    }
    resetHoldOnly();
  }

  function handleHoldLeave(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse') {
      return;
    }
    handleHoldEnd(event);
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

    resetRevealLocalState();
  }

  return (
    <ScreenScaffold
      scroll="none"
      title={t('roleHeader')}
      subtitle={isAiPlayer ? revealPlayer.name : t('handoff', { name: revealPlayer.name })}
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

      {isAiPlayer ? (
        <section className="glass-card phase-card section-card cinematic-panel ai-skip-card">
          <PlayerAvatar avatarId={revealPlayer.avatarId} alt={revealPlayer.name} size={104} />
          <PlayerNameplate
            name={revealPlayer.name}
            progression={revealPlayer.progression}
            isAi
            showMedals
          />
          <h2>{t('aiRevealSkipping')}</h2>
          <p className="subtle">{t('aiRevealSkipHint')}</p>
        </section>
      ) : currentMatch.revealState.phase === 'handoff' ? (
        <section className="glass-card handoff-card section-card cinematic-panel">
          <PlayerAvatar avatarId={revealPlayer.avatarId} alt={revealPlayer.name} size={104} />
          <PlayerNameplate
            name={revealPlayer.name}
            progression={revealPlayer.progression}
            isAi={isAiPlayer}
            showMedals
          />
          <h2>{t('handoff', { name: revealPlayer.name })}</h2>
          <p className="subtle">{t('handoffSafetyNote')}</p>
          <GameButton variant="cta" size="lg" onClick={() => void goToReveal()}>
            {t('continue')}
          </GameButton>
        </section>
      ) : (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`glass-card reveal-card section-card ${revealClass}`.trim()}>
          <div className={`reveal-mask-wrapper ${isRevealed ? 'reveal-mask-wrapper--revealed' : 'reveal-mask-wrapper--concealed'}`}>
            <div className="reveal-content">
              {isSpy ? (
                <div className="reveal-meta spy-meta-grid">
                  <h2 className="role-title role-title-spy spy-hero-title">{t('roleSpy')}</h2>
                  <div className="spy-category-display">
                    <span className="spy-category-label">{t('category')}</span>
                    <strong className="spy-category-name">{currentMatch.match.category}</strong>
                  </div>
                  <div className="spy-hint-box">
                    <span className="spy-hint-label">{t('hint')}</span>
                    <p className="spy-hint">{spyHintText}</p>
                  </div>
                  {teammateNames.length > 0 ? (
                    <p className="spy-team-note">
                      {t('spyTeamNote', {
                        names: teammateNames.join(' - '),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="reveal-meta">
                  <h2 className="role-title role-title-citizen">{t('roleCitizen')}</h2>
                  <p>{t('secretWord')}</p>
                  <strong className="word-display">{citizenWord}</strong>
                </div>
              )}
            </div>
            {!isRevealed ? (
              <button
                type="button"
                className={`reveal-mask ${holdPhase === 'holding' ? 'holding' : ''} ${holdProgress >= 0.8 ? 'charged' : ''}`}
                data-sfx="off"
                onPointerDown={handleHoldStart}
                onPointerUp={handleHoldEnd}
                onPointerLeave={handleHoldLeave}
                onPointerCancel={handleHoldEnd}
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
              >
                <span className="reveal-mask-title">{t('pressHoldReveal')}</span>
                <span className="reveal-mask-progress" aria-hidden>
                    <span className="reveal-mask-progress-track">
                      <span className="reveal-mask-progress-grid" />
                      <span className="reveal-mask-progress-fill" style={{ transform: `scaleX(${holdProgress})` }} />
                      <span className="reveal-mask-progress-glow" style={{ transform: `translateX(${progressGlowShift}%)` }} />
                    </span>
                  </span>
                <span className="reveal-mask-percentage" aria-hidden>
                  {holdProgressPercent}%
                </span>
                <span className="reveal-mask-helper">{holdHelperText}</span>
              </button>
            ) : null}
          </div>

          {isRevealed && !canMoveNext ? (
            <p className="cooldown-text">
              {t('revealReadyIn', {
                seconds: Math.max(1, Math.ceil((nextReadyAt - now) / 1000)),
              })}
            </p>
          ) : null}
        </motion.section>
      )}

      {isAiPlayer ? (
        <PrimaryActionBar className="reveal-action-bar">
          <RestartRoundButton />
          <div className="subtle">{t('aiAutoContinue')}</div>
        </PrimaryActionBar>
      ) : (
        <PrimaryActionBar
          className="reveal-action-bar"
          leading={
            <div className="restart-leading-actions">
              <GameButton variant="ghost" onClick={() => void goBack()} disabled={currentMatch.revealState.phase === 'handoff'}>
                {t('back')}
              </GameButton>
              <RestartRoundButton />
            </div>
          }
        >
          {currentMatch.revealState.phase === 'reveal' ? (
            <GameButton
              variant="cta"
              size="lg"
              className="next-btn"
              onClick={() => void goNext()}
              disabled={!canMoveNext}
            >
              {t('next')}
            </GameButton>
          ) : (
            <div className="subtle">{t('safeTransitionHint')}</div>
          )}
        </PrimaryActionBar>
      )}
      <p className="subtle restart-round-note">{t('restartRoundNote')}</p>
    </ScreenScaffold>
  );
}
