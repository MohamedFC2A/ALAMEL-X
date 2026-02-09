import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { db, ensureTeaser } from '../lib/db';
import { StatusBanner } from '../components/StatusBanner';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeMatch = useLiveQuery(() => db.activeMatch.get('active'), []);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const matches = useLiveQuery(() => db.matches.count(), []);
  const teaser = useLiveQuery(() => db.teaser.get('ai_teaser'), []);
  const [teaserOpen, setTeaserOpen] = useState(false);

  const enabledPlayers = (players ?? []).filter((player) => player.enabled).length;

  useEffect(() => {
    void ensureTeaser();
  }, []);

  async function handleToggleNotify(nextValue: boolean) {
    await db.teaser.put({
      id: 'ai_teaser',
      wantsNotify: nextValue,
      updatedAt: Date.now(),
    });
  }

  return (
    <main className="home-screen screen-shell">
      <header className="hero-panel glass-card cinematic-panel">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{t('homeTagline')}</p>
            <h1>{t('appName')}</h1>
            <p className="hero-subtitle">{t('homeSubline')}</p>
          </div>
          <div className="metric-rail" aria-label="مؤشرات الرئيسية">
            <div className="metric-chip glass-card">
              <strong>{enabledPlayers}</strong>
              <span>{t('players')}</span>
            </div>
            <div className="metric-chip glass-card">
              <strong>{matches ?? 0}</strong>
              <span>{t('history')}</span>
            </div>
            <div className="metric-chip glass-card">
              <strong>{activeMatch ? '1' : '0'}</strong>
              <span>{t('activeMatchResume')}</span>
            </div>
          </div>
        </div>
      </header>

      {activeMatch ? <StatusBanner tone="warning">{t('activeMatchResumeHint')}</StatusBanner> : null}

      <section className="action-grid">
        <motion.button
          id="play-btn"
          className="home-action home-action-primary glass-card"
          onClick={() => navigate('/play/setup')}
          type="button"
          whileTap={{ scale: 0.985 }}
        >
          <span>{t('play')}</span>
          <small>{t('startRoundFast')}</small>
        </motion.button>

        <motion.button
          id="play-ai-btn"
          className="home-action glass-card"
          onClick={() => setTeaserOpen(true)}
          type="button"
          whileTap={{ scale: 0.985 }}
        >
          <span>{t('playAi')}</span>
          <small>{t('comingSoon')}</small>
        </motion.button>

        <motion.button
          id="players-btn"
          className="home-action glass-card"
          onClick={() => navigate('/players')}
          type="button"
          whileTap={{ scale: 0.985 }}
        >
          <span>{t('playersRecords')}</span>
          <small>{t('manageProfiles')}</small>
        </motion.button>

        <motion.button
          id="settings-btn"
          className="home-action glass-card"
          onClick={() => navigate('/settings')}
          type="button"
          whileTap={{ scale: 0.985 }}
        >
          <span>{t('globalSettings')}</span>
          <small>{t('tuneExperience')}</small>
        </motion.button>
      </section>

      {activeMatch ? (
        <section className="cta-panel glass-card cinematic-panel">
          <div>
            <h3>{t('activeMatchResume')}</h3>
            <p className="subtle">{t('activeMatchResumeHint')}</p>
          </div>
          <button className="primary-btn" type="button" onClick={() => navigate('/play/reveal')}>
            {t('activeMatchResume')}
          </button>
        </section>
      ) : null}

      {teaserOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setTeaserOpen(false)}>
          <div className="modal glass-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{t('aiTeaserTitle')}</h2>
            <p>{t('aiTeaserBody')}</p>
            <ul>
              <li>{t('aiFeature1')}</li>
              <li>{t('aiFeature2')}</li>
              <li>{t('aiFeature3')}</li>
            </ul>
            <label className="switch-row" htmlFor="notify-toggle">
              <span>{t('notifyMe')}</span>
              <input
                id="notify-toggle"
                type="checkbox"
                checked={teaser?.wantsNotify ?? false}
                onChange={(event) => void handleToggleNotify(event.target.checked)}
              />
            </label>
            <button type="button" className="primary-btn" onClick={() => setTeaserOpen(false)}>
              {t('close')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
