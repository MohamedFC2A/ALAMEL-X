import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { db } from '../lib/db';
import { startMatch, wordsUsageSummary, resetWordLocks, minPlayersForSpyCount, isValidPlayerCount } from '../lib/game-repository';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { StatusBanner } from '../components/StatusBanner';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { GameButton } from '../components/GameButton';
import type { Player } from '../types';

function recommendedSpyCount(playerCount: number): 1 | 2 {
  return playerCount >= 7 ? 2 : 1;
}

export function PlaySetupScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useLiveQuery(() => db.players.filter((player) => player.enabled).toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [spyCountOverride, setSpyCountOverride] = useState<1 | 2 | null>(null);
  const [playerPage, setPlayerPage] = useState(0);
  const [errorKey, setErrorKey] = useState<string>('');
  const [usageSummary, setUsageSummary] = useState<{ used: number; total: number }>({ used: 0, total: 0 });

  const usageRate = useMemo(() => {
    if (!usageSummary.total) {
      return 0;
    }
    return Math.round((usageSummary.used / usageSummary.total) * 100);
  }, [usageSummary]);
  const remainingWords = Math.max(0, usageSummary.total - usageSummary.used);
  const spyCount = spyCountOverride ?? recommendedSpyCount(selectedPlayers.length);
  const overridden = spyCountOverride !== null;
  const minPlayers = minPlayersForSpyCount(spyCount);
  const playersPerPage = 6;
  const totalPlayerPages = Math.max(1, Math.ceil((players?.length ?? 0) / playersPerPage));
  const clampedPlayerPage = Math.min(playerPage, totalPlayerPages - 1);
  const pagePlayers = (players ?? []).slice(
    clampedPlayerPage * playersPerPage,
    (clampedPlayerPage + 1) * playersPerPage,
  );

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    (players ?? []).forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const hasAiSelected = selectedPlayers.some((id) => playerMap.get(id)?.kind === 'ai');
  const aiReady = !hasAiSelected || Boolean(settings?.aiEnabled);

  useEffect(() => {
    void wordsUsageSummary().then(setUsageSummary);
  }, []);

  useEffect(() => {
    if (!players) {
      return;
    }

    if (players.length < minPlayersForSpyCount(1)) {
      navigate('/players', { state: { reason: 'noPlayersRedirect' } });
    }
  }, [navigate, players]);

  function togglePlayer(playerId: string) {
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, playerId];
    });
  }

  async function handleStart() {
    if (!isValidPlayerCount(selectedPlayers.length, spyCount)) {
      setErrorKey('selectPlayers');
      return;
    }

    setErrorKey('');

    try {
      await startMatch(selectedPlayers, spyCount);
      navigate('/play/reveal');
    } catch (error) {
      if (error instanceof Error && error.message === 'WORD_EXHAUSTED') {
        setErrorKey('wordsExhausted');
        return;
      }
      setErrorKey('startGame');
    }
  }

  async function handleResetWords() {
    const confirmed = window.confirm(t('confirmResetWords'));
    if (!confirmed) {
      return;
    }
    await resetWordLocks();
    const summary = await wordsUsageSummary();
    setUsageSummary(summary);
    setErrorKey('');
  }

  return (
    <ScreenScaffold scroll="none" title={t('setupMatch')} subtitle={t('selectPlayers')} eyebrow={t('phaseSetupEyebrow')}>
      <PhaseIndicator current={1} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />

      <section className="setup-insights panel-grid glass-card section-card cinematic-panel">
        <div className="metric-chip">
          <strong>{selectedPlayers.length}</strong>
          <span>{t('selectedCount')}</span>
        </div>
        <div className="metric-chip">
          <strong>{spyCount}</strong>
          <span>{t('spiesCount')}</span>
        </div>
        <div className="metric-chip">
          <strong>{usageRate}%</strong>
          <span>{t('wordsUsageLabel')}</span>
        </div>
        <div className="metric-chip">
          <strong>{remainingWords}</strong>
          <span>{t('wordsRemainingLabel')}</span>
        </div>
      </section>

      <StatusBanner tone={usageRate > 90 ? 'danger' : usageRate > 70 ? 'warning' : 'default'}>
        {t('wordsUsageLabel')}: {usageSummary.used} / {usageSummary.total} ({usageRate}%) | {t('wordsRemainingLabel')}: {remainingWords}
      </StatusBanner>

      {errorKey ? <StatusBanner tone="danger">{t(errorKey)}</StatusBanner> : null}
      {hasAiSelected && !aiReady ? (
        <StatusBanner tone="danger">
          {t('aiSetupRequired')}
          <div className="actions-row banner-actions">
            <GameButton variant="primary" size="md" onClick={() => navigate('/settings')}>
              {t('configureAi')}
            </GameButton>
          </div>
        </StatusBanner>
      ) : hasAiSelected ? (
        <StatusBanner tone="warning">{t('aiInternetHint')}</StatusBanner>
      ) : null}

      <section className="player-select-grid compact panel-grid section-card">
        {pagePlayers.map((player) => {
          const selected = selectedPlayers.includes(player.id);
          const maxReached = !selected && selectedPlayers.length >= 10;
          const isAi = player.kind === 'ai';
          return (
            <button
              key={player.id}
              type="button"
              className={`glass-card pick-card ${selected ? 'selected' : ''}`}
              onClick={() => togglePlayer(player.id)}
              disabled={maxReached}
            >
              <PlayerAvatar avatarId={player.avatarId} alt={player.name} size={58} />
              <span className="pick-card-name">
                {player.name} {isAi ? <span className="ai-badge ai-badge--small">{t('aiBadge')}</span> : null}
              </span>
            </button>
          );
        })}
      </section>

      {totalPlayerPages > 1 ? (
        <div className="actions-row">
          <GameButton
            variant="ghost"
            onClick={() => setPlayerPage((prev) => Math.min(totalPlayerPages - 1, Math.max(0, prev - 1)))}
            disabled={clampedPlayerPage === 0}
          >
            {t('back')}
          </GameButton>
          <span className="subtle">
            {clampedPlayerPage + 1} / {totalPlayerPages}
          </span>
          <GameButton
            variant="ghost"
            onClick={() => setPlayerPage((prev) => Math.min(totalPlayerPages - 1, prev + 1))}
            disabled={clampedPlayerPage >= totalPlayerPages - 1}
          >
            {t('next')}
          </GameButton>
        </div>
      ) : null}

      <section className="glass-card spy-count-panel section-card cinematic-panel toggle-panel">
        <p>{t('spiesCount')}</p>
        <div className="pill-row" role="group" aria-label={t('spiesCount')}>
          <button type="button" className={`pill-btn ${spyCount === 1 ? 'active' : ''}`} onClick={() => setSpyCountOverride(1)}>
            1 {!overridden && recommendedSpyCount(selectedPlayers.length) === 1 ? <span className="recommend-badge">{t('spyRecommended')}</span> : null}
          </button>
          <button type="button" className={`pill-btn ${spyCount === 2 ? 'active' : ''}`} onClick={() => setSpyCountOverride(2)}>
            2 {!overridden && recommendedSpyCount(selectedPlayers.length) === 2 ? <span className="recommend-badge">{t('spyRecommended')}</span> : null}
          </button>
        </div>
      </section>

      <PrimaryActionBar
        className="sticky-action-bar"
        leading={
          <span>
            {t('selectedCount')}: {selectedPlayers.length}/10
          </span>
        }
      >
        <GameButton variant="cta" size="lg" onClick={() => void handleStart()} disabled={selectedPlayers.length < minPlayers || !aiReady}>
          {t('startGame')}
        </GameButton>
        <GameButton variant="ghost" onClick={() => void handleResetWords()}>
          {t('resetWordLocks')}
        </GameButton>
      </PrimaryActionBar>
    </ScreenScaffold>
  );
}
