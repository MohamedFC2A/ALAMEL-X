import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { avatarPresets } from '../data/avatars';
import { buildAiPlayer, buildPlayer, buildQuickPlayers, deletePlayer, upsertPlayer } from '../lib/game-repository';
import { db, defaultAccessibility } from '../lib/db';
import type { Player, PlayerAccessibility } from '../types';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { StatusBanner } from '../components/StatusBanner';
import { formatWordForDisplay } from '../lib/word-format';
import { GameButton } from '../components/GameButton';

interface PlayerFormState {
  id?: string;
  name: string;
  avatarId: string;
  enabled: boolean;
  accessibility: PlayerAccessibility;
}

function createDefaultForm(): PlayerFormState {
  return {
    name: '',
    avatarId: avatarPresets[0].id,
    enabled: true,
    accessibility: { ...defaultAccessibility },
  };
}

export function PlayersScreen() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const players = useLiveQuery(async () => (await db.players.toArray()).sort((a, b) => a.createdAt - b.createdAt), []);
  const matches = useLiveQuery(() => db.matches.orderBy('endedAt').reverse().limit(20).toArray(), []);

  const [formState, setFormState] = useState<PlayerFormState>(createDefaultForm());
  const [isModalOpen, setModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const historySectionRef = useRef<HTMLElement | null>(null);

  const hasPlayers = (players?.length ?? 0) > 0;
  const redirectMessage = location.state && (location.state as { reason?: string }).reason;
  const focusHistory = searchParams.get('focus') === 'history';

  useEffect(() => {
    if (!focusHistory) {
      return;
    }
    const node = historySectionRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusHistory]);

  useEffect(() => {
    if (!players) {
      return;
    }
    const disabledPlayers = players.filter((player) => !player.enabled);
    if (!disabledPlayers.length) {
      return;
    }
    void db.players.bulkPut(
      disabledPlayers.map((player) => ({
        ...player,
        enabled: true,
        updatedAt: Date.now(),
      })),
    );
  }, [players]);

  const playerMatches = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of matches ?? []) {
      for (const playerId of match.match.playerIds) {
        map.set(playerId, (map.get(playerId) ?? 0) + 1);
      }
    }
    return map;
  }, [matches]);

  function openCreateModal() {
    setActionError('');
    setFormState(createDefaultForm());
    setModalOpen(true);
  }

  function openEditModal(player: Player) {
    setActionError('');
    setFormState({
      id: player.id,
      name: player.name,
      avatarId: player.avatarId,
      enabled: true,
      accessibility: player.accessibility,
    });
    setModalOpen(true);
  }

  async function savePlayer() {
    if (!formState.name.trim()) {
      return;
    }

    if (formState.id) {
      const existing = await db.players.get(formState.id);
      if (!existing) {
        return;
      }

      await upsertPlayer({
        ...existing,
        name: formState.name.trim(),
        avatarId: formState.avatarId,
        enabled: true,
        accessibility: formState.accessibility,
      });
    } else {
      const player = buildPlayer(formState.name.trim(), formState.avatarId);
      await upsertPlayer({
        ...player,
        accessibility: formState.accessibility,
      });
    }

    setModalOpen(false);
    setFormState(createDefaultForm());
  }

  async function handleDelete(player: Player) {
    const confirmed = window.confirm(t('confirmDeletePlayer', { name: player.name }));
    if (!confirmed) {
      return;
    }

    try {
      await deletePlayer(player.id);
      setActionError('');
    } catch (error) {
      if (error instanceof Error && error.message === 'PLAYER_IN_ACTIVE_MATCH') {
        setActionError(t('deletePlayerBlockedActiveMatch'));
        return;
      }
      setActionError(t('deletePlayerFailed'));
    }
  }

  async function handleQuickAdd() {
    const existing = await db.players.count();
    if (existing > 0) {
      return;
    }
    const quickPlayers = buildQuickPlayers();
    await db.players.bulkPut(quickPlayers);
  }

  async function handleAddAiPlayer() {
    const player = await buildAiPlayer();
    await upsertPlayer(player);
  }

  return (
    <ScreenScaffold title={t('playersRecords')} subtitle={t('playersManagementSubtitle')} eyebrow={t('players')}>
      {redirectMessage ? <StatusBanner tone="warning">{t(redirectMessage)}</StatusBanner> : null}
      {actionError ? <StatusBanner tone="danger">{actionError}</StatusBanner> : null}

      <div className="actions-row case-actions">
        <GameButton type="button" variant="primary" size="lg" onClick={openCreateModal}>
          {t('addPlayer')}
        </GameButton>
        <GameButton type="button" variant="ghost" size="md" onClick={() => void handleAddAiPlayer()}>
          {t('addAiPlayer')}
        </GameButton>
        {!hasPlayers ? (
          <GameButton type="button" variant="ghost" size="md" onClick={() => void handleQuickAdd()}>
            {t('quickAddPlayers')}
          </GameButton>
        ) : null}
      </div>

      <section className="stack-list">
        <div className="section-heading">
          <h2>{t('players')}</h2>
          <span className="section-count-badge">{t('playersCountBadge', { count: (players ?? []).length })}</span>
        </div>
        {(players ?? []).map((player) => {
          const isAi = player.kind === 'ai';
          return (
          <GlassCard key={player.id} className="player-card section-card cinematic-panel">
            <div className="player-row">
              <PlayerAvatar avatarId={player.avatarId} alt={player.name} size={58} />
              <div className="player-main">
                <h3>
                  {player.name} {isAi ? <span className="ai-badge">{t('aiBadge')}</span> : null}
                </h3>
                <p>{isAi ? t('aiPlayerProfileHint') : t('humanPlayerProfileHint')}</p>
              </div>
              <div className="player-actions">
                <GameButton type="button" variant="ghost" size="md" onClick={() => openEditModal(player)}>
                  {t('editPlayer')}
                </GameButton>
                <GameButton type="button" variant="danger" size="md" onClick={() => void handleDelete(player)}>
                  {t('deletePlayer')}
                </GameButton>
              </div>
            </div>

            <div className="stats-grid">
              <span>{t('gamesPlayed')}: {player.stats.gamesPlayed}</span>
              <span>{t('spyWins')}: {player.stats.spyWins}</span>
              <span>{t('citizenWins')}: {player.stats.citizenWins}</span>
              <span>{t('records')}: {playerMatches.get(player.id) ?? 0}</span>
            </div>
          </GlassCard>
          );
        })}

        {!hasPlayers ? (
          <StatusBanner>
            {t('emptyPlayersList')} {t('quickAddHint')}
          </StatusBanner>
        ) : null}
      </section>

      <section
        ref={historySectionRef}
        id="history-section"
        className={`history-section ${focusHistory ? 'history-section--focused' : ''}`.trim()}
      >
        <div className="section-heading">
          <h2>{t('history')}</h2>
          <span className="section-count-badge">{t('historyCountBadge', { count: (matches ?? []).length })}</span>
        </div>
        {(matches ?? []).length === 0 ? (
          <StatusBanner>{t('emptyHistory')}</StatusBanner>
        ) : (
          (matches ?? []).map((entry) => (
            <GlassCard key={entry.id} className="history-card section-card cinematic-panel">
              <strong>{new Date(entry.endedAt).toLocaleString(i18n.language)}</strong>
              <p>{entry.result.winner === 'citizens' ? t('winnerCitizens') : t('winnerSpies')}</p>
              <p>
                {t('correctWord')}:{' '}
                {formatWordForDisplay(
                  i18n.language === 'ar' ? entry.wordTextAr : entry.wordTextEn,
                  i18n.language as 'en' | 'ar',
                )}
              </p>
            </GlassCard>
          ))
        )}
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="modal glass-card section-card cinematic-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>{formState.id ? t('editPlayer') : t('addPlayer')}</h2>

            <label className="form-field">
              <span>{t('name')}</span>
              <input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                maxLength={30}
              />
            </label>

            <div className="avatar-grid">
              {avatarPresets.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  className={`avatar-option ${formState.avatarId === avatar.id ? 'selected' : ''}`}
                  onClick={() => setFormState((prev) => ({ ...prev, avatarId: avatar.id }))}
                >
                  <img src={avatar.src} alt={avatar.label} width={52} height={52} />
                </button>
              ))}
            </div>

            <div className="modal-section">
              <h3>{t('accessibility')}</h3>
              <label className="switch-row">
                <span>{t('shortSighted')}</span>
                <input
                  type="checkbox"
                  checked={formState.accessibility.shortSightedMode}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, shortSightedMode: event.target.checked },
                    }))
                  }
                />
              </label>
              <label className="switch-row">
                <span>{t('longSighted')}</span>
                <input
                  type="checkbox"
                  checked={formState.accessibility.longSightedMode}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, longSightedMode: event.target.checked },
                    }))
                  }
                />
              </label>
              <label className="switch-row">
                <span>{t('blurReduction')}</span>
                <input
                  type="checkbox"
                  checked={formState.accessibility.blurReduction}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, blurReduction: event.target.checked },
                    }))
                  }
                />
              </label>
              <label className="switch-row">
                <span>{t('highContrast')}</span>
                <input
                  type="checkbox"
                  checked={formState.accessibility.highContrast}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, highContrast: event.target.checked },
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>
                  {t('extraReadTime')} ({t('extraSeconds', {
                    seconds: Math.round(formState.accessibility.extraReadMs / 1000),
                  })})
                </span>
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={500}
                  value={formState.accessibility.extraReadMs}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      accessibility: {
                        ...prev.accessibility,
                        extraReadMs: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
            </div>

            <div className="modal-actions">
              <GameButton type="button" variant="ghost" size="md" onClick={() => setModalOpen(false)}>
                {t('cancel')}
              </GameButton>
              <GameButton type="button" variant="cta" size="lg" onClick={() => void savePlayer()}>
                {t('save')}
              </GameButton>
            </div>
          </div>
        </div>
      ) : null}
    </ScreenScaffold>
  );
}
