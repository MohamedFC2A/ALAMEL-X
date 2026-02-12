import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerNameplate } from '../components/PlayerNameplate';
import { db } from '../lib/db';
import {
  completeActiveMatch,
  computeSpyGuessCorrect,
  pickWinnerFromLeaders,
  tallyBallots,
  updateActiveMatch,
} from '../lib/game-repository';
import { useClockNow } from '../hooks/useClockNow';
import { nowMs } from '../lib/clock';
import type { Player } from '../types';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { StatusBanner } from '../components/StatusBanner';
import { useActiveMatch } from '../hooks/useActiveMatch';
import { formatWordForDisplay } from '../lib/word-format';
import { GameButton } from '../components/GameButton';
import { DeepSeekError } from '../lib/ai/deepseek-client';
import { decideGuess, decideVoteDetailed, runtimeConfigFromSettings } from '../lib/ai/agent';
import { speakWithEleven } from '../lib/ai/eleven-client';
import { RestartRoundButton } from '../components/RestartRoundButton';
import { playUiFeedback } from '../lib/ui-feedback';

export function ResolutionScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const activeMatchState = useActiveMatch();
  const activeMatch = activeMatchState?.match ?? null;
  const players = useLiveQuery(() => db.players.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const now = useClockNow();
  const guessMs = Math.max(10_000, (settings?.guessSeconds ?? 30) * 1000);

  const voteStateKey = `${activeMatch?.voteState?.round ?? 1}:${activeMatch?.voteState?.voterIndex ?? 0}:${activeMatch?.voteState?.phase ?? 'handoff'}`;
  const [ballotPickState, setBallotPickState] = useState<{ key: string; value: string }>({ key: '', value: '' });
  const ballotPick = ballotPickState.key === voteStateKey ? ballotPickState.value : '';
  const [ballotPageState, setBallotPageState] = useState<{ key: string; value: number }>({ key: '', value: 0 });
  const ballotPage = ballotPageState.key === voteStateKey ? ballotPageState.value : 0;
  const setBallotPick = (value: string) => setBallotPickState({ key: voteStateKey, value });
  const setBallotPage = (value: number | ((prev: number) => number)) => {
    setBallotPageState((prev) => {
      const base = prev.key === voteStateKey ? prev.value : 0;
      const nextValue = typeof value === 'function' ? value(base) : value;
      return { key: voteStateKey, value: nextValue };
    });
  };
  const [guessInput, setGuessInput] = useState('');

  const aiVoteHandledKeyRef = useRef('');
  const aiGuessHandledKeyRef = useRef('');
  const [aiVoteRetryNonce, setAiVoteRetryNonce] = useState(0);
  const [aiGuessRetryNonce, setAiGuessRetryNonce] = useState(0);
  const [aiVoteError, setAiVoteError] = useState<{ key: string; message: string } | null>(null);
  const [aiGuessError, setAiGuessError] = useState<{ key: string; message: string } | null>(null);
  const [aiVoteNarration, setAiVoteNarration] = useState<{ key: string; message: string } | null>(null);
  const stageCueRef = useRef('');
  const resultCueRef = useRef('');

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    (players ?? []).forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const formatAiError = useCallback((error: unknown): string => {
    if (error instanceof DeepSeekError) {
      if (error.kind === 'auth') return t('aiAuthError');
      if (error.kind === 'rate_limit') return t('aiRateLimitError');
      if (error.kind === 'network') return t('aiNetworkError');
      return t('aiUnknownError');
    }
    return t('aiUnknownError');
  }, [t]);

  const submitBallotWithPick = useCallback(async (pick: string) => {
    if (!pick) {
      return;
    }

    const refreshed = await db.activeMatch.get('active');
    if (!refreshed || refreshed.match.status !== 'resolution' || refreshed.resolutionStage !== 'vote' || !refreshed.voteState) {
      return;
    }

    const voteState = refreshed.voteState;
    const voterId = refreshed.match.playerIds[voteState.voterIndex];
    if (!voterId) {
      return;
    }

    const nextBallots = { ...voteState.ballots, [voterId]: pick };
    const isLastVoter = voteState.voterIndex >= refreshed.match.playerIds.length - 1;

    if (!isLastVoter) {
      await updateActiveMatch({
        voteState: {
          ...voteState,
          phase: 'handoff',
          voterIndex: voteState.voterIndex + 1,
          ballots: nextBallots,
        },
      });
      return;
    }

    const { counts, leaders } = tallyBallots(nextBallots);
    if (leaders.length === 0) {
      await updateActiveMatch({
        resolutionStage: 'result',
        votedSpyIds: [],
        voteOutcome: 'missed',
        winner: 'spies',
        spyGuess: '',
        spyGuessCorrect: false,
        guessTimedOut: false,
        voteState: {
          ...voteState,
          ballots: nextBallots,
          lastTally: counts,
        },
      });
      return;
    }

    if (leaders.length > 1 && voteState.round === 1) {
      await updateActiveMatch({
        votedSpyIds: [],
        voteOutcome: undefined,
        voteState: {
          phase: 'handoff',
          voterIndex: 0,
          ballots: {},
          round: 2,
          candidates: leaders,
          lastTally: counts,
        },
      });
      return;
    }

    const winnerId =
      leaders.length === 1 ? leaders[0] : pickWinnerFromLeaders(leaders, refreshed.match.id, voteState.round);
    const captured = refreshed.match.spyIds.includes(winnerId);

    if (captured) {
      await updateActiveMatch({
        resolutionStage: 'guess',
        votedSpyIds: [winnerId],
        voteOutcome: 'captured',
        guessEndsAt: nowMs() + guessMs,
        spyGuess: '',
        spyGuessCorrect: false,
        guessTimedOut: false,
        voteState: {
          ...voteState,
          ballots: nextBallots,
          lastTally: counts,
        },
      });
      return;
    }

    await updateActiveMatch({
      resolutionStage: 'result',
      votedSpyIds: [winnerId],
      voteOutcome: 'missed',
      winner: 'spies',
      spyGuess: '',
      spyGuessCorrect: false,
      guessTimedOut: false,
      voteState: {
        ...voteState,
        ballots: nextBallots,
        lastTally: counts,
      },
    });
  }, [guessMs]);

  const submitGuess = useCallback(async (selectedGuess: string) => {
    const current = await db.activeMatch.get('active');
    if (!current) {
      return;
    }

    const correct = computeSpyGuessCorrect(current, selectedGuess);

    await updateActiveMatch({
      spyGuess: selectedGuess,
      spyGuessCorrect: correct,
      guessTimedOut: false,
      resolutionStage: 'result',
      winner: correct ? 'spies' : 'citizens',
    });
  }, []);

  const guessStateKey =
    activeMatch && activeMatch.resolutionStage === 'guess' ? `${activeMatch.match.id}:${activeMatch.guessEndsAt ?? 0}` : '';

  useEffect(() => {
    if (!activeMatchState) {
      return;
    }
    if (!activeMatch) {
      navigate('/');
      return;
    }
    if (activeMatch.match.status !== 'resolution') {
      navigate('/play/discussion');
    }
  }, [activeMatch, activeMatchState, navigate]);

  const guessRemainingMs = Math.max(0, (activeMatch?.guessEndsAt ?? 0) - now);
  const guessRemaining = Math.ceil(guessRemainingMs / 1000);
  const guessTimerExpired = activeMatch?.resolutionStage === 'guess' && activeMatch?.guessEndsAt && guessRemainingMs <= 0;

  useEffect(() => {
    if (!activeMatch || activeMatch.resolutionStage !== 'vote' || activeMatch.voteState) {
      return;
    }

    void updateActiveMatch({
      votedSpyIds: [],
      voteOutcome: undefined,
      voteState: {
        phase: 'handoff',
        voterIndex: 0,
        ballots: {},
        round: 1,
      },
    });
  }, [activeMatch]);

  useEffect(() => {
    if (!activeMatch) {
      stageCueRef.current = '';
      resultCueRef.current = '';
      return;
    }

    const stageKey = `${activeMatch.match.id}:${activeMatch.resolutionStage}`;
    if (stageCueRef.current !== stageKey) {
      stageCueRef.current = stageKey;
      if (activeMatch.resolutionStage === 'guess') {
        playUiFeedback('confirm', 1.04);
      } else if (activeMatch.resolutionStage === 'result') {
        playUiFeedback(activeMatch.winner === 'citizens' ? 'confirm' : 'danger', 1.12);
      } else {
        playUiFeedback('tap', 0.9);
      }
    }

    if (activeMatch.resolutionStage !== 'result') {
      resultCueRef.current = '';
      return;
    }

    const winnerKey = `${activeMatch.match.id}:${activeMatch.winner}:${activeMatch.spyGuessCorrect ? 1 : 0}:${activeMatch.guessTimedOut ? 1 : 0}`;
    if (resultCueRef.current === winnerKey) {
      return;
    }
    resultCueRef.current = winnerKey;
    playUiFeedback(activeMatch.winner === 'citizens' ? 'confirm' : 'danger', 1.16);
  }, [activeMatch]);

  useEffect(() => {
    if (!settings?.aiEnabled) {
      return;
    }

    if (!activeMatch) {
      return;
    }

    const voteState = activeMatch.voteState;
    if (!voteState) {
      return;
    }

    if (activeMatch.resolutionStage !== 'vote' || voteState.phase !== 'handoff') {
      return;
    }

    const voterId = activeMatch.match.playerIds[voteState.voterIndex];
    const voter = voterId ? playerMap.get(voterId) ?? null : null;
    if (!voterId || !voter || voter.kind !== 'ai') {
      return;
    }

    if (aiVoteHandledKeyRef.current === voteStateKey) {
      return;
    }

    aiVoteHandledKeyRef.current = voteStateKey;

    void (async () => {
      try {
        const config = runtimeConfigFromSettings(settings);
        const language = i18n.language as 'en' | 'ar';
        const role = activeMatch.match.spyIds.includes(voterId) ? 'spy' : 'citizen';
        const secretWord =
          role === 'citizen' ? (language === 'ar' ? activeMatch.wordTextAr : activeMatch.wordTextEn) : undefined;
        const spyHintText = role === 'spy' ? (language === 'ar' ? activeMatch.spyHintAr : activeMatch.spyHintEn) : undefined;
        const spyTeammateNames =
          role === 'spy'
            ? activeMatch.match.spyIds.filter((id) => id !== voterId).map((id) => playerMap.get(id)?.name ?? id)
            : [];

        const context = {
          language,
          aiPlayer: { id: voter.id, name: voter.name },
          role,
          category: activeMatch.match.category,
          secretWord,
          spyHintText,
          spyTeammateNames,
        } as const;

        const thread = activeMatch.ai?.threads?.[voterId] ?? { messages: [], summary: '' };
        const candidateIds = (voteState.candidates ?? activeMatch.match.playerIds).filter((id) => id !== voterId);
        const candidates = candidateIds.map((id) => ({ id, name: playerMap.get(id)?.name ?? id })).filter((item) => item.id);

        const decision = await decideVoteDetailed(config, context, thread, candidates);
        setAiVoteNarration({ key: voteStateKey, message: decision.reason });
        if (settings.soundEnabled && settings.aiVoiceOutputEnabled) {
          try {
            await speakWithEleven({ text: decision.reason });
          } catch {
            // keep vote flow moving even if TTS fails
          }
        }
        await submitBallotWithPick(decision.choice);
      } catch (err) {
        setAiVoteError({ key: voteStateKey, message: formatAiError(err) });
      }
    })();
  }, [
    activeMatch,
    aiVoteRetryNonce,
    formatAiError,
    i18n.language,
    playerMap,
    settings,
    submitBallotWithPick,
    voteStateKey,
  ]);

  useEffect(() => {
    if (!activeMatch || activeMatch.resolutionStage !== 'guess') {
      return;
    }

    const capturedSpyId = activeMatch.votedSpyIds[0] ?? '';
    const capturedSpy = capturedSpyId ? playerMap.get(capturedSpyId) ?? null : null;

    if (!capturedSpyId || !capturedSpy || capturedSpy.kind !== 'ai') {
      return;
    }

    const key = `${activeMatch.match.id}:${activeMatch.guessEndsAt ?? 0}`;
    if (aiGuessHandledKeyRef.current === key) {
      return;
    }

    if (!settings?.aiEnabled) {
      return;
    }

    aiGuessHandledKeyRef.current = key;

    void (async () => {
      try {
        const config = runtimeConfigFromSettings(settings);
        const language = i18n.language as 'en' | 'ar';
        const role = activeMatch.match.spyIds.includes(capturedSpyId) ? 'spy' : 'citizen';
        const secretWord =
          role === 'citizen' ? (language === 'ar' ? activeMatch.wordTextAr : activeMatch.wordTextEn) : undefined;
        const spyHintText =
          role === 'spy' ? (language === 'ar' ? activeMatch.spyHintAr : activeMatch.spyHintEn) : undefined;
        const spyTeammateNames =
          role === 'spy'
            ? activeMatch.match.spyIds.filter((id) => id !== capturedSpyId).map((id) => playerMap.get(id)?.name ?? id)
            : [];

        const context = {
          language,
          aiPlayer: { id: capturedSpy.id, name: capturedSpy.name },
          role,
          category: activeMatch.match.category,
          secretWord,
          spyHintText,
          spyTeammateNames,
        } as const;

        const thread = activeMatch.ai?.threads?.[capturedSpyId] ?? { messages: [], summary: '' };
        const rawOptions = (language === 'ar' ? activeMatch.spyGuessOptionsAr : activeMatch.spyGuessOptionsEn).map((opt) =>
          formatWordForDisplay(opt, language),
        );
        const guess = await decideGuess(config, context, thread, rawOptions);
        await submitGuess(guess);
      } catch (err) {
        setAiGuessError({ key, message: formatAiError(err) });
      }
    })();
  }, [
    activeMatch,
    aiGuessRetryNonce,
    formatAiError,
    i18n.language,
    playerMap,
    settings,
    submitGuess,
  ]);

  if (!activeMatch) {
    return null;
  }

  const currentMatch = activeMatch;
  const guessDraft = guessInput || currentMatch.spyGuess;

  async function startBallot() {
    const refreshed = await db.activeMatch.get('active');
    if (!refreshed || refreshed.match.status !== 'resolution' || refreshed.resolutionStage !== 'vote' || !refreshed.voteState) {
      return;
    }

    await updateActiveMatch({
      voteState: {
        ...refreshed.voteState,
        phase: 'ballot',
      },
    });
  }

  async function submitBallot() {
    if (!ballotPick) {
      return;
    }

    await submitBallotWithPick(ballotPick);
  }

  async function finishRound() {
    await completeActiveMatch();
    navigate('/play/summary');
  }

  const voteState = currentMatch.voteState;
  const voterId = voteState ? currentMatch.match.playerIds[voteState.voterIndex] : '';
  const voter = voterId ? playerMap.get(voterId) ?? null : null;
  const candidatesPerPage = 6;
  const ballotCandidateIds = (voteState?.candidates ?? currentMatch.match.playerIds).filter((id) => id !== voterId);
  const totalBallotPages = Math.max(1, Math.ceil(ballotCandidateIds.length / candidatesPerPage));
  const clampedBallotPage = Math.min(ballotPage, totalBallotPages - 1);
  const pageCandidates = ballotCandidateIds.slice(
    clampedBallotPage * candidatesPerPage,
    (clampedBallotPage + 1) * candidatesPerPage,
  );
  const isAiVoter = voter?.kind === 'ai';
  const aiVoteNarrationMessage = aiVoteNarration?.key === voteStateKey ? aiVoteNarration.message : '';
  const capturedSpyId = currentMatch.votedSpyIds[0] ?? '';
  const capturedSpy = capturedSpyId ? playerMap.get(capturedSpyId) ?? null : null;
  const isAiCapturedSpy = capturedSpy?.kind === 'ai';
  const aiGuessErrorMessage = aiGuessError?.key === guessStateKey ? aiGuessError.message : '';
  const isTeamSpyGuess = currentMatch.match.spyIds.length > 1;
  const guessPromptText = isTeamSpyGuess ? t('spyGuessPromptTeam') : t('spyGuessPrompt');

  const tieWasBroken = (() => {
    if (currentMatch.resolutionStage === 'vote' || voteState?.round !== 2 || !voteState.lastTally) {
      return false;
    }
    const values = Object.values(voteState.lastTally);
    if (values.length === 0) {
      return false;
    }
    const max = Math.max(...values);
    const leaders = Object.entries(voteState.lastTally).filter(([, count]) => count === max);
    return leaders.length > 1;
  })();

  return (
    <ScreenScaffold scroll="none" title={t('spiesRevealed')} eyebrow={t('phaseResolveEyebrow')}>
      <PhaseIndicator current={4} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />
      <section className="resolution-stage-hud panel-grid glass-card">
        <div className={`stage-pill ${currentMatch.resolutionStage === 'vote' ? 'active' : ''}`}>{t('stageVote')}</div>
        <div className={`stage-pill ${currentMatch.resolutionStage === 'guess' ? 'active' : ''}`}>{t('stageGuess')}</div>
        <div className={`stage-pill ${currentMatch.resolutionStage === 'result' ? 'active' : ''}`}>{t('stageResult')}</div>
      </section>
      <div className="resolution-restart-row">
        <RestartRoundButton />
        <span className="subtle restart-round-note">{t('restartRoundNote')}</span>
      </div>

      {currentMatch.resolutionStage === 'vote' ? (
        !voteState || !voter ? (
          <StatusBanner>{t('votePhase')}</StatusBanner>
        ) : voteState.phase === 'handoff' ? (
          isAiVoter ? (
            <section className="glass-card handoff-card section-card cinematic-panel">
              {voteState.round === 2 ? <StatusBanner tone="warning">{t('voteRunoff')}</StatusBanner> : null}
              <PlayerAvatar avatarId={voter.avatarId} alt={voter.name} size={104} />
              <PlayerNameplate
                name={voter.name}
                progression={voter.progression}
                isAi
                showMedals
              />
              <h2>{t('aiVoteInProgress')}</h2>
              <p className="subtle">
                {t('voteProgress', { current: voteState.voterIndex + 1, total: currentMatch.match.playerIds.length })}
              </p>
              {settings?.aiEnabled ? (
                aiVoteError?.key === voteStateKey ? (
                  <StatusBanner tone="danger">{aiVoteError.message}</StatusBanner>
                ) : aiVoteNarrationMessage ? (
                  <StatusBanner tone="success">{aiVoteNarrationMessage}</StatusBanner>
                ) : (
                  <StatusBanner tone="warning">{t('aiThinking')}</StatusBanner>
                )
              ) : (
                <StatusBanner tone="danger">{t('aiSetupRequired')}</StatusBanner>
              )}
              {settings?.aiEnabled && aiVoteError?.key === voteStateKey ? (
                <div className="actions-row">
                  <GameButton
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setAiVoteError(null);
                      aiVoteHandledKeyRef.current = '';
                      setAiVoteRetryNonce((prev) => prev + 1);
                    }}
                  >
                    {t('retry')}
                  </GameButton>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="glass-card handoff-card section-card cinematic-panel">
              {voteState.round === 2 ? <StatusBanner tone="warning">{t('voteRunoff')}</StatusBanner> : null}
              <PlayerAvatar avatarId={voter.avatarId} alt={voter.name} size={104} />
              <PlayerNameplate
                name={voter.name}
                progression={voter.progression}
                isAi={voter.kind === 'ai'}
                showMedals
              />
              <h2>{t('voteHandoff', { name: voter.name })}</h2>
              <p className="subtle">
                {t('voteProgress', { current: voteState.voterIndex + 1, total: currentMatch.match.playerIds.length })}
              </p>
              <p className="subtle">{t('handoffSafetyNote')}</p>
              <GameButton
                variant="cta"
                size="lg"
                onClick={() => {
                  void startBallot();
                }}
              >
                {t('continue')}
              </GameButton>
            </section>
          )
        ) : (
          <section className="glass-card phase-card section-card cinematic-panel">
            <h2>{t('votePhase')}</h2>
            {voteState.round === 2 ? <StatusBanner tone="warning">{t('voteRunoff')}</StatusBanner> : null}
            <p className="subtle">
              {t('voteProgress', { current: voteState.voterIndex + 1, total: currentMatch.match.playerIds.length })}
            </p>
            <p>{t('votePickOne')}</p>
            <div className="player-select-grid compact">
              {pageCandidates.map((id) => {
                const player = playerMap.get(id);
                const label = player?.name ?? id;
                const avatarId = player?.avatarId ?? 'boy_1';
                const picked = ballotPick === id;

                return (
                  <button
                    key={id}
                    type="button"
                    className={`glass-card pick-card ${picked ? 'selected' : ''}`}
                    onClick={() => {
                      setBallotPick(id);
                    }}
                  >
                    <PlayerAvatar avatarId={avatarId} alt={label} size={56} />
                    <PlayerNameplate
                      name={label}
                      progression={player?.progression}
                      isAi={player?.kind === 'ai'}
                      compact
                      showMedals
                      className="pick-card-nameplate"
                    />
                  </button>
                );
              })}
            </div>
            {totalBallotPages > 1 ? (
              <div className="actions-row">
                <GameButton
                  variant="ghost"
                  onClick={() => setBallotPage((prev) => Math.max(0, prev - 1))}
                  disabled={clampedBallotPage === 0}
                >
                  {t('back')}
                </GameButton>
                <span className="subtle">
                  {clampedBallotPage + 1} / {totalBallotPages}
                </span>
                <GameButton
                  variant="ghost"
                  onClick={() => setBallotPage((prev) => Math.min(totalBallotPages - 1, prev + 1))}
                  disabled={clampedBallotPage >= totalBallotPages - 1}
                >
                  {t('next')}
                </GameButton>
              </div>
            ) : null}
            <PrimaryActionBar className="sticky-action-bar">
              <GameButton
                variant="cta"
                size="lg"
                disabled={!ballotPick}
                onClick={() => {
                  void submitBallot();
                }}
              >
                {t('submitVote')}
              </GameButton>
            </PrimaryActionBar>
          </section>
        )
      ) : null}

      {currentMatch.resolutionStage === 'guess' ? (
        isAiCapturedSpy && capturedSpy ? (
          <section className="glass-card phase-card section-card cinematic-panel">
            <StatusBanner tone="success">
              {t('voteCapturedInfo')}
            </StatusBanner>
            {isTeamSpyGuess ? <StatusBanner tone="warning">{t('spyGuessTeamInfo')}</StatusBanner> : null}
            {tieWasBroken ? <StatusBanner tone="warning">{t('voteTieBroken')}</StatusBanner> : null}
            <h2>{t('aiGuessInProgress')}</h2>
            <p className="subtle">{guessPromptText}</p>
            <h2 className="countdown-value">{guessRemaining}</h2>
            {settings?.aiEnabled ? (
              aiGuessErrorMessage ? (
                <StatusBanner tone="danger">{aiGuessErrorMessage}</StatusBanner>
              ) : (
                <StatusBanner tone="warning">{t('aiThinking')}</StatusBanner>
              )
            ) : (
              <StatusBanner tone="danger">{t('aiSetupRequired')}</StatusBanner>
            )}
            {settings?.aiEnabled && aiGuessErrorMessage ? (
              <div className="actions-row">
                <GameButton
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setAiGuessError(null);
                    aiGuessHandledKeyRef.current = '';
                    setAiGuessRetryNonce((prev) => prev + 1);
                  }}
                >
                  {t('retry')}
                </GameButton>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="glass-card phase-card section-card cinematic-panel">
            <StatusBanner tone="success">
              {t('voteCapturedInfo')}
            </StatusBanner>
            {isTeamSpyGuess ? <StatusBanner tone="warning">{t('spyGuessTeamInfo')}</StatusBanner> : null}
            {tieWasBroken ? <StatusBanner tone="warning">{t('voteTieBroken')}</StatusBanner> : null}
            <p>{guessPromptText}</p>
            <div className={`guess-countdown${guessRemaining <= 5 ? ' urgent' : ''}`}>{guessRemaining}</div>
            <p className="subtle">{t('spyGuessPick')}</p>
            <div className="choice-grid">
              {(i18n.language === 'ar' ? currentMatch.spyGuessOptionsAr : currentMatch.spyGuessOptionsEn).map((option) => {
                const displayOption = option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`glass-card choice-card ${guessDraft === displayOption ? 'selected' : ''}`}
                    onClick={() => {
                      setGuessInput(displayOption);
                      void submitGuess(displayOption);
                    }}
                  >
                    {t('confirmLocation', { location: option }) || `Confirm: ${option}`}
                  </button>
                );
              })}
            </div>
            {guessTimerExpired ? <div className="guess-required-flash">{t('guessRequiredAlert')}</div> : null}
          </section>
        )
      ) : null}

      {currentMatch.resolutionStage === 'result' ? (
        <section className="glass-card phase-card section-card cinematic-panel">
          {(() => {
            const voteOutcome = currentMatch.voteOutcome;
            const isGuessTimedOut = currentMatch.guessTimedOut;
            return (
              <>
                <div className={`result-winner-banner ${currentMatch.winner === 'citizens' ? 'citizens-won' : 'spies-won'}`}>
                  {currentMatch.winner === 'citizens'
                    ? t('winnerCitizens')
                    : (() => {
                        const spyNames = currentMatch.match.spyIds.map((id) => playerMap.get(id)?.name ?? id);
                        if (spyNames.length === 1) {
                          return t('winnerSpySingle', { name: spyNames[0] });
                        }
                        return t('winnerSpiesTeam', { names: spyNames.join(' و ') });
                      })()}
                </div>
                {tieWasBroken ? <StatusBanner tone="warning">{t('voteTieBroken')}</StatusBanner> : null}
                {voteOutcome === 'missed' ? (
                  <StatusBanner tone="warning">
                    {t('voteFailed')}
                  </StatusBanner>
                ) : isGuessTimedOut ? (
                  <StatusBanner tone="warning">
                    {t('guessTimeoutMessage')}
                  </StatusBanner>
                ) : (
                  <StatusBanner tone={currentMatch.spyGuessCorrect ? 'danger' : 'success'}>
                    {currentMatch.spyGuess
                      ? currentMatch.spyGuessCorrect
                        ? t('guessCorrectMessage')
                        : t('guessWrongMessage')
                      : t('guessPending')}
                  </StatusBanner>
                )}
                <p>{voteOutcome === 'captured' ? t('voteSucceeded') : voteOutcome === 'missed' ? t('voteMissedInfo') : ''}</p>
              </>
            );
          })()}
          <p>
            {t('submitGuess')}:
            <span className="word-pill">
              {currentMatch.spyGuess || t('guessPending')}
            </span>
          </p>
          <p>
            {t('correctWord')}:
            <span className="word-pill">
              {formatWordForDisplay(i18n.language === 'ar' ? currentMatch.wordTextAr : currentMatch.wordTextEn, i18n.language as 'en' | 'ar')}
            </span>
          </p>
          <p>
            {t('similarWords')}:
            <span className="word-list">
              {(i18n.language === 'ar' ? currentMatch.decoysAr : currentMatch.decoysEn)
                .map((word) => formatWordForDisplay(word, i18n.language as 'en' | 'ar'))
                .join(' - ')}
            </span>
          </p>
          <PrimaryActionBar className="sticky-action-bar">
            <GameButton variant="cta" size="lg" onClick={() => {
              void finishRound();
            }}>
              {t('finishRound')}
            </GameButton>
          </PrimaryActionBar>
        </section>
      ) : null}
    </ScreenScaffold>
  );
}
