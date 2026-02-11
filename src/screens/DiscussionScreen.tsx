import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { updateActiveMatch } from '../lib/game-repository';
import { useClockNow } from '../hooks/useClockNow';
import { nowMs } from '../lib/clock';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { StatusBanner } from '../components/StatusBanner';
import { useActiveMatch } from '../hooks/useActiveMatch';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameButton } from '../components/GameButton';
import { Bot } from 'lucide-react';
import type { Player } from '../types';
import { AiDeskModal } from '../components/AiDeskModal';
import { useAiDiscussionOrchestrator } from '../hooks/useAiDiscussionOrchestrator';

export function DiscussionScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const activeMatchState = useActiveMatch();
  const activeMatch = activeMatchState?.match ?? null;
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const [aiDeskOpen, setAiDeskOpen] = useState(false);
  const now = useClockNow();
  const discussionMs = Math.max(60_000, (settings?.discussionMinutes ?? 3) * 60 * 1000);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    (players ?? []).forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const aiPlayers = useMemo(() => {
    if (!activeMatch) {
      return [] as Player[];
    }

    const ids =
      activeMatch.ai?.playerIds?.length
        ? activeMatch.ai.playerIds
        : activeMatch.match.playerIds.filter((id) => playerMap.get(id)?.kind === 'ai');

    return ids.map((id) => playerMap.get(id)).filter((player): player is Player => Boolean(player));
  }, [activeMatch, playerMap]);

  const hasAi = aiPlayers.length > 0;
  const aiMatchMode = activeMatch?.ai?.mode ?? 'full';
  const aiDiscussionEnabled = hasAi && aiMatchMode === 'full';
  const orchestrator = useAiDiscussionOrchestrator({
    activeMatch,
    aiPlayers: aiDiscussionEnabled ? aiPlayers : [],
    playerMap,
    settings,
    language: i18n.language as 'en' | 'ar',
  });

  const orchestratorStatusLabel =
    orchestrator.state.status === 'listening'
      ? t('aiOrchestratorListening')
      : orchestrator.state.status === 'processing'
        ? t('aiOrchestratorProcessing')
        : orchestrator.state.status === 'speaking'
          ? t('aiOrchestratorSpeaking')
          : orchestrator.state.status === 'waiting_answer'
            ? t('aiOrchestratorWaitingAnswer')
            : t('aiOrchestratorIdle');

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
    <ScreenScaffold scroll="none" title={t('discussion')} subtitle={t('discussionSubtitle')} eyebrow={t('phaseTalkEyebrow')}>
      <PhaseIndicator current={3} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />

      {activeMatch.match.status === 'ready' ? (
        <section className="glass-card phase-card section-card cinematic-panel">
          <h2>{t('closePhone')}</h2>
          <p className="subtle">{t('discussionStartHint')}</p>
          <GameButton variant="cta" size="lg" onClick={() => void startDiscussion()}>
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

      <PrimaryActionBar className="sticky-action-bar">
        {aiDiscussionEnabled ? (
          <GameButton variant="ghost" onClick={() => setAiDeskOpen(true)} icon={<Bot size={18} aria-hidden />}>
            {t('aiDeskButton')}
          </GameButton>
        ) : null}
        <GameButton variant="ghost" onClick={() => void skipDiscussion()}>
          {t('skipTimer')}
        </GameButton>
      </PrimaryActionBar>

      {hasAi && aiMatchMode === 'vote_only' && activeMatch.match.status === 'discussion' ? (
        <StatusBanner tone="warning">{t('aiModeVoteOnlyDiscussionHint')}</StatusBanner>
      ) : null}

      {aiDiscussionEnabled && activeMatch.match.status === 'discussion' ? (
        <section className="glass-card section-card cinematic-panel ai-orchestrator-strip">
          <div className="ai-orchestrator-strip-row">
            <span className="eyebrow">{t('aiOrchestratorStatus')}</span>
            <strong>{orchestratorStatusLabel}</strong>
          </div>
          <div className="ai-orchestrator-strip-row subtle">
            <span>
              {orchestrator.state.pendingTargetName
                ? t('aiOrchestratorPendingTarget', { name: orchestrator.state.pendingTargetName })
                : t('aiOrchestratorNoPending')}
            </span>
            <span>
              {t('aiMonitorSilence')}: {Math.round(orchestrator.state.silenceMs / 1000)} {t('seconds')}
            </span>
          </div>
          {orchestrator.error ? <StatusBanner tone="danger">{orchestrator.error}</StatusBanner> : null}
        </section>
      ) : null}

      {activeMatch && aiDiscussionEnabled ? (
        <AiDeskModal
          open={aiDeskOpen}
          onClose={() => setAiDeskOpen(false)}
          aiPlayers={aiPlayers}
          orchestratorState={orchestrator.state}
          runtimeEnabled={orchestrator.runtimeEnabled}
          onToggleRuntime={orchestrator.toggleRuntimeEnabled}
          error={orchestrator.error}
          onClearError={orchestrator.clearError}
        />
      ) : null}
    </ScreenScaffold>
  );
}
