import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { db } from '../lib/db';
import { startMatch, wordsUsageSummary, resetWordLocks } from '../lib/game-repository';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { StatusBanner } from '../components/StatusBanner';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { GameButton } from '../components/GameButton';

function recommendedSpyCount(playerCount: number): 1 | 2 {
  return playerCount >= 7 ? 2 : 1;
}

export function PlaySetupScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useLiveQuery(() => db.players.filter((player) => player.enabled).toArray(), []);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [spyCount, setSpyCount] = useState<1 | 2>(1);
  const [overridden, setOverridden] = useState(false);
  const [errorKey, setErrorKey] = useState<string>('');
  const [usageSummary, setUsageSummary] = useState<{ used: number; total: number }>({ used: 0, total: 0 });

  const usageRate = useMemo(() => {
    if (!usageSummary.total) {
      return 0;
    }
    return Math.round((usageSummary.used / usageSummary.total) * 100);
  }, [usageSummary]);
  const remainingWords = Math.max(0, usageSummary.total - usageSummary.used);

  useEffect(() => {
    void wordsUsageSummary().then(setUsageSummary);
  }, []);

  useEffect(() => {
    if (!players) {
      return;
    }

    if (players.length < 4) {
      navigate('/players', { state: { reason: 'noPlayersRedirect' } });
    }
  }, [navigate, players]);

  useEffect(() => {
    if (!overridden) {
      setSpyCount(recommendedSpyCount(selectedPlayers.length));
    }
  }, [selectedPlayers.length, overridden]);

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
    if (selectedPlayers.length < 4 || selectedPlayers.length > 10) {
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
    <ScreenScaffold title={t('setupMatch')} subtitle={t('selectPlayers')} eyebrow={t('phaseSetupEyebrow')}>
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

      <section className="player-select-grid panel-grid section-card">
        {(players ?? []).map((player) => {
          const selected = selectedPlayers.includes(player.id);
          const maxReached = !selected && selectedPlayers.length >= 10;
          return (
            <button
              key={player.id}
              type="button"
              className={`glass-card pick-card ${selected ? 'selected' : ''}`}
              onClick={() => togglePlayer(player.id)}
              disabled={maxReached}
            >
              <PlayerAvatar avatarId={player.avatarId} alt={player.name} size={58} />
              <span>{player.name}</span>
            </button>
          );
        })}
      </section>

      <section className="glass-card spy-count-panel section-card cinematic-panel toggle-panel">
        <p>{t('spiesCount')}</p>
        <div className="pill-row" role="group" aria-label={t('spiesCount')}>
          <button type="button" className={`pill-btn ${spyCount === 1 ? 'active' : ''}`} onClick={() => { setSpyCount(1); setOverridden(true); }}>
            1 {!overridden && recommendedSpyCount(selectedPlayers.length) === 1 ? <span className="recommend-badge">{t('spyRecommended')}</span> : null}
          </button>
          <button type="button" className={`pill-btn ${spyCount === 2 ? 'active' : ''}`} onClick={() => { setSpyCount(2); setOverridden(true); }}>
            2 {!overridden && recommendedSpyCount(selectedPlayers.length) === 2 ? <span className="recommend-badge">{t('spyRecommended')}</span> : null}
          </button>
        </div>
      </section>

      <PrimaryActionBar
        leading={
          <span>
            {t('selectedCount')}: {selectedPlayers.length}/10
          </span>
        }
      >
        <GameButton variant="cta" size="lg" onClick={() => void handleStart()} disabled={selectedPlayers.length < 4}>
          {t('startGame')}
        </GameButton>
      </PrimaryActionBar>

      <div className="actions-row">
        <GameButton variant="ghost" onClick={() => void handleResetWords()}>
          {t('resetWordLocks')}
        </GameButton>
      </div>
    </ScreenScaffold>
  );
}
