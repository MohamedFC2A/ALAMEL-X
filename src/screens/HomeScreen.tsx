import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { History, RotateCcw, Settings2, UsersRound } from 'lucide-react';
import { db } from '../lib/db';
import { abandonActiveMatch } from '../lib/game-repository';
import { GameButton } from '../components/GameButton';
import { PlayerNameplate } from '../components/PlayerNameplate';
import { ensureProgressionState } from '../lib/player-progression';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeMatch = useLiveQuery(() => db.activeMatch.get('active'), []);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const reducedMotion = Boolean(settings?.reducedMotionMode);
  const motionSpeed = Math.max(0.35, settings?.animationSpeed ?? 1);
  const topPlayer = (players ?? [])
    .slice()
    .sort((left, right) => {
      const leftProgress = ensureProgressionState(left.progression);
      const rightProgress = ensureProgressionState(right.progression);
      if (rightProgress.level !== leftProgress.level) {
        return rightProgress.level - leftProgress.level;
      }
      if (rightProgress.xp !== leftProgress.xp) {
        return rightProgress.xp - leftProgress.xp;
      }
      return right.stats.gamesPlayed - left.stats.gamesPlayed;
    })[0];

  const handleMission = () => {
    if (activeMatch) {
      navigate('/play/reveal');
    } else {
      navigate('/play/setup');
    }
  };

  const handleRestart = async () => {
    const confirmed = window.confirm(t('confirmRestartRound'));
    if (!confirmed) return;
    await abandonActiveMatch();
  };

  return (
    <main className="home-hud">
      <section className="home-hud__top">
        <p className="home-hud__kicker">ALAMEL-X</p>
        <h1>{t('appName')}</h1>
      </section>

      <section className="home-hud__center">
        {topPlayer ? (
          <div className="home-hud__champion glass-card">
            <span className="subtle">أعلى رتبة الآن</span>
            <PlayerNameplate
              name={topPlayer.name}
              progression={topPlayer.progression}
              isAi={topPlayer.kind === 'ai'}
              showMedals
            />
          </div>
        ) : null}
        <motion.div
          className="home-hud__mission-wrap"
          animate={reducedMotion ? undefined : { scale: [1, 1.04, 1] }}
          transition={reducedMotion ? undefined : { duration: 2.8 / motionSpeed, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GameButton
            id="start-mission-btn"
            variant="cta"
            size="hero"
            onClick={handleMission}
          >
            {activeMatch ? t('continueMission') : t('startMission')}
          </GameButton>
        </motion.div>
        {activeMatch ? (
          <GameButton
            variant="danger"
            size="md"
            icon={<RotateCcw size={16} aria-hidden />}
            onClick={() => void handleRestart()}
          >
            {t('restartRound')}
          </GameButton>
        ) : null}
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
