import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { History, Settings2, UsersRound } from 'lucide-react';
import { db } from '../lib/db';
import { GameButton } from '../components/GameButton';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeMatch = useLiveQuery(() => db.activeMatch.get('active'), []);

  const missionLabel = activeMatch ? t('resumeMission') : t('startMission');
  const missionPath = activeMatch ? '/play/reveal' : '/play/setup';

  return (
    <main className="home-hud">
      <section className="home-hud__top">
        <p className="home-hud__kicker">ALAMEL-X</p>
        <h1>{t('appName')}</h1>
      </section>

      <section className="home-hud__center">
        <motion.div
          className="home-hud__mission-wrap"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GameButton
            id="start-mission-btn"
            variant="primary"
            size="hero"
            onClick={() => navigate(missionPath)}
          >
            {missionLabel}
          </GameButton>
        </motion.div>
      </section>

      <nav className="home-hud__footer" aria-label={t('homeUtilities')}>
        <GameButton
          variant="icon"
          size="icon"
          icon={<UsersRound size={20} aria-hidden />}
          onClick={() => navigate('/players')}
          aria-label={t('players')}
        >
          {t('players')}
        </GameButton>
        <GameButton
          variant="icon"
          size="icon"
          icon={<History size={20} aria-hidden />}
          onClick={() => navigate('/players?focus=history')}
          aria-label={t('history')}
        >
          {t('history')}
        </GameButton>
        <GameButton
          variant="icon"
          size="icon"
          icon={<Settings2 size={20} aria-hidden />}
          onClick={() => navigate('/settings')}
          aria-label={t('settings')}
        >
          {t('settings')}
        </GameButton>
      </nav>
    </main>
  );
}
