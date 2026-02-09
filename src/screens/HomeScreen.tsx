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

  const handleStart = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    navigate('/play/setup');
  };

  const handleResume = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    navigate('/play/reveal'); // Or determine correct phase if possible, but reveal/discussion is safe
  };

  const handleAbort = async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    if (window.confirm(t('abortConfirm') || 'Abort current mission? All progress will be lost.')) {
      await db.activeMatch.delete('active');
      navigate('/play/setup');
    }
  };

  return (
    <main className="home-hud">
      <section className="home-hud__top">
        <p className="home-hud__kicker">ALAMEL-X</p>
        <h1>{t('appName')}</h1>
      </section>

      <section className="home-hud__center">
        {activeMatch ? (
          <div className="home-hud__dual-actions">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GameButton
                id="resume-mission-btn"
                variant="primary"
                size="hero"
                onClick={handleResume}
                className="btn-resume"
              >
                {t('resumeMission')}
              </GameButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <GameButton
                id="abort-mission-btn"
                variant="danger" // Assuming 'danger' variant exists or will fall back
                size="lg"
                onClick={() => void handleAbort()}
                className="btn-abort"
              >
                {t('abortMission') || 'ABORT MISSION'}
              </GameButton>
            </motion.div>
          </div>
        ) : (
          <motion.div
            className="home-hud__mission-wrap"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GameButton
              id="start-mission-btn"
              variant="primary"
              size="hero"
              onClick={handleStart}
            >
              {t('startMission')}
            </GameButton>
          </motion.div>
        )}
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
