import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { PrimaryActionBar } from '../components/PrimaryActionBar';
import { PhaseIndicator } from '../components/PhaseIndicator';
import { StatusBanner } from '../components/StatusBanner';
import { formatWordForDisplay } from '../lib/word-format';
import { GameButton } from '../components/GameButton';

export function SummaryScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const latestMatch = useLiveQuery(() => db.matches.orderBy('endedAt').last(), []);

  if (!latestMatch) {
    return (
      <ScreenScaffold scroll="none" title={t('roundSummary')} subtitle={t('summaryUnavailable')}>
        <GameButton variant="primary" size="lg" onClick={() => navigate('/')}>
          {t('returnHome')}
        </GameButton>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold scroll="none" title={t('roundSummary')} subtitle={t('summarySubtitle')} eyebrow={t('phaseSummaryEyebrow')}>
      <PhaseIndicator current={4} labels={[t('phaseSetup'), t('phaseReveal'), t('phaseTalk'), t('phaseResolve')]} />
      <StatusBanner tone={latestMatch.result.winner === 'citizens' ? 'success' : 'danger'}>
        {latestMatch.result.winner === 'citizens' ? t('winnerCitizens') : t('winnerSpies')}
      </StatusBanner>

      <section className="glass-card phase-card section-card cinematic-panel">
        <div className="section-heading">
          <h2>{t('roundSummary')}</h2>
          <span className="subtle">{new Date(latestMatch.endedAt).toLocaleTimeString(i18n.language)}</span>
        </div>
        <p>
          {t('submitGuess')}:
          <span className="word-pill">
            {latestMatch.result.spyGuess
              ? formatWordForDisplay(latestMatch.result.spyGuess, i18n.language as 'en' | 'ar')
              : t('guessPending')}
          </span>
        </p>
        <p>
          {t('correctWord')}:
          <span className="word-pill">
            {formatWordForDisplay(i18n.language === 'ar' ? latestMatch.wordTextAr : latestMatch.wordTextEn, i18n.language as 'en' | 'ar')}
          </span>
        </p>
        <p>
          {t('similarWords')}:
          <span className="word-list">
            {(i18n.language === 'ar' ? latestMatch.decoysAr : latestMatch.decoysEn)
              .map((word) => formatWordForDisplay(word, i18n.language as 'en' | 'ar'))
              .join(' - ')}
          </span>
        </p>
      </section>

      <PrimaryActionBar className="sticky-action-bar" leading={<GameButton variant="ghost" onClick={() => navigate('/')}>{t('returnHome')}</GameButton>}>
        <GameButton variant="cta" size="lg" onClick={() => navigate('/play/setup')}>
          {t('quickReplay')}
        </GameButton>
      </PrimaryActionBar>
    </ScreenScaffold>
  );
}
