import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { db } from '../lib/db';
import {
  completeActiveMatch,
  computeSpyGuessCorrect,
  computeVoteOutcome,
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

export function ResolutionScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const activeMatchState = useActiveMatch();
  const activeMatch = activeMatchState?.match ?? null;
  const players = useLiveQuery(() => db.players.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const now = useClockNow();
  const guessMs = Math.max(10_000, (settings?.guessSeconds ?? 30) * 1000);

  const [selectedVotes, setSelectedVotes] = useState<string[]>([]);
  const [guessInput, setGuessInput] = useState('');

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    (players ?? []).forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

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

  if (!activeMatch) {
    return null;
  }

  const currentMatch = activeMatch;
  const spyCount = currentMatch.match.spyIds.length;
  const voteDraft = selectedVotes.length > 0 ? selectedVotes : currentMatch.votedSpyIds;
  const guessDraft = guessInput || currentMatch.spyGuess;

  function toggleVote(playerId: string) {
    const workingVotes = [...voteDraft];
    if (workingVotes.includes(playerId)) {
      setSelectedVotes(workingVotes.filter((id) => id !== playerId));
      return;
    }
    if (workingVotes.length >= spyCount) {
      setSelectedVotes(workingVotes);
      return;
    }
    setSelectedVotes([...workingVotes, playerId]);
  }

  async function submitVote() {
    await updateActiveMatch({ votedSpyIds: voteDraft });

    await updateActiveMatch({
      resolutionStage: 'guess',
      votedSpyIds: voteDraft,
      guessEndsAt: nowMs() + guessMs,
      spyGuess: '',
      spyGuessCorrect: false,
    });
  }

  async function submitGuess(selectedGuess: string) {
    const current = await db.activeMatch.get('active');
    if (!current) {
      return;
    }

    const correct = computeSpyGuessCorrect(current, selectedGuess);

    await updateActiveMatch({
      spyGuess: selectedGuess,
      spyGuessCorrect: correct,
      resolutionStage: 'result',
      winner: correct ? 'spies' : 'citizens',
    });
  }

  async function finishRound() {
    await completeActiveMatch();
    navigate('/play/summary');
  }

  return (
    <ScreenScaffold title={t('spiesRevealed')} subtitle={currentMatch.match.spyIds.map((id) => playerMap.get(id)?.name ?? id).join(', ')} eyebrow={t('phaseResolveEyebrow')}>
      <PhaseIndicator current={4} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />
      <section className="resolution-stage-hud panel-grid glass-card">
        <div className={`stage-pill ${currentMatch.resolutionStage === 'vote' ? 'active' : ''}`}>{t('stageVote')}</div>
        <div className={`stage-pill ${currentMatch.resolutionStage === 'guess' ? 'active' : ''}`}>{t('stageGuess')}</div>
        <div className={`stage-pill ${currentMatch.resolutionStage === 'result' ? 'active' : ''}`}>{t('stageResult')}</div>
      </section>

      {currentMatch.resolutionStage === 'vote' ? (
        <section className="glass-card phase-card section-card cinematic-panel">
          <h2>{t('votePhase')}</h2>
          <p>{t('pickSuspects', { count: spyCount })}</p>
          <div className="player-select-grid compact">
            {currentMatch.match.playerIds.map((id) => {
              const player = playerMap.get(id);
              if (!player) {
                return null;
              }
              const picked = voteDraft.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`glass-card pick-card ${picked ? 'selected' : ''}`}
                  onClick={() => toggleVote(id)}
                >
                  <PlayerAvatar avatarId={player.avatarId} alt={player.name} size={44} />
                  <span>{player.name}</span>
                </button>
              );
            })}
          </div>
          <PrimaryActionBar>
            <GameButton
              variant="primary"
              size="lg"
              disabled={voteDraft.length !== spyCount}
              onClick={() => void submitVote()}
            >
              {t('submitVote')}
            </GameButton>
          </PrimaryActionBar>
        </section>
      ) : null}

      {currentMatch.resolutionStage === 'guess' ? (
        <section className="glass-card phase-card section-card cinematic-panel">
          <StatusBanner tone={computeVoteOutcome(currentMatch) ? 'success' : 'warning'}>
            {computeVoteOutcome(currentMatch) ? t('voteCapturedInfo') : t('voteMissedInfo')}
          </StatusBanner>
          <p>{t('spyGuessPrompt')}</p>
          <h2 className="countdown-value">{guessRemaining}</h2>
          <p className="subtle">{t('spyGuessPick')}</p>
          <div className="choice-grid">
            {(i18n.language === 'ar' ? currentMatch.spyGuessOptionsAr : currentMatch.spyGuessOptionsEn).map((option) => {
              const displayOption = formatWordForDisplay(option, i18n.language as 'en' | 'ar');
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
                {displayOption}
              </button>
              );
            })}
          </div>
          {guessRemaining === 0 ? <StatusBanner tone="warning">{t('guessRequired')}</StatusBanner> : null}
        </section>
      ) : null}

      {currentMatch.resolutionStage === 'result' ? (
        <section className="glass-card phase-card section-card cinematic-panel">
          {(() => {
            const citizensCaughtSpies = computeVoteOutcome(currentMatch);
            return (
              <>
                <StatusBanner tone={currentMatch.winner === 'citizens' ? 'success' : 'danger'}>
            {currentMatch.winner === 'citizens' ? t('winnerCitizens') : t('winnerSpies')}
          </StatusBanner>
                <StatusBanner tone={currentMatch.spyGuessCorrect ? 'success' : 'danger'}>
                  {currentMatch.spyGuess
                    ? currentMatch.spyGuessCorrect
                      ? t('guessCorrectMessage')
                      : t('guessWrongMessage')
                    : t('guessPending')}
                </StatusBanner>
                <p>{citizensCaughtSpies ? t('voteCapturedInfo') : t('voteMissedInfo')}</p>
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
          <PrimaryActionBar>
            <GameButton variant="primary" size="lg" onClick={() => void finishRound()}>
              {t('finishRound')}
            </GameButton>
          </PrimaryActionBar>
        </section>
      ) : null}
    </ScreenScaffold>
  );
}
