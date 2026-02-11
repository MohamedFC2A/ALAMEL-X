import { useEffect, useRef } from 'react';
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
import { buildAwardSummaryText, getMedalDefinitionById } from '../lib/player-progression';
import { speakWithEleven } from '../lib/ai/eleven-client';
import { speakWithBrowserSynthesis } from '../lib/ai/browser-voice';
import { playUiFeedback } from '../lib/ui-feedback';

const narratedAwardMatches = new Set<string>();

export function SummaryScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const latestMatch = useLiveQuery(() => db.matches.orderBy('endedAt').last(), []);
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const winnerCueRef = useRef('');

  useEffect(() => {
    if (!latestMatch) {
      winnerCueRef.current = '';
      return;
    }
    const cueKey = `${latestMatch.id}:${latestMatch.result.winner}`;
    if (winnerCueRef.current === cueKey) {
      return;
    }
    winnerCueRef.current = cueKey;
    playUiFeedback(latestMatch.result.winner === 'citizens' ? 'confirm' : 'danger', 1.14);
  }, [latestMatch]);

  useEffect(() => {
    if (!latestMatch) {
      return;
    }

    const awards = latestMatch.roundAwards ?? [];
    if (!awards.length) {
      return;
    }

    if (!settings?.soundEnabled || !settings.aiVoiceOutputEnabled) {
      return;
    }

    if (narratedAwardMatches.has(latestMatch.id)) {
      return;
    }

    const narration = awards
      .map((award) => buildAwardSummaryText(award))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!narration) {
      return;
    }

    narratedAwardMatches.add(latestMatch.id);
    void (async () => {
      try {
        await speakWithEleven({ text: narration });
      } catch {
        try {
          await speakWithBrowserSynthesis(narration, i18n.language as 'en' | 'ar');
        } catch {
          // Ignore voice fallback failure to keep summary screen responsive.
        }
      }
    })();
  }, [i18n.language, latestMatch, settings?.aiVoiceOutputEnabled, settings?.soundEnabled]);

  if (!latestMatch) {
    return (
      <ScreenScaffold scroll="none" title={t('roundSummary')} subtitle={t('summaryUnavailable')}>
        <GameButton variant="primary" size="lg" onClick={() => navigate('/')}>
          {t('returnHome')}
        </GameButton>
      </ScreenScaffold>
    );
  }

  const roundAwards = latestMatch.roundAwards ?? [];

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

      <section className="glass-card phase-card section-card cinematic-panel">
        <div className="section-heading">
          <h2>{t('roundAwardsTitle')}</h2>
          <span className="subtle">{roundAwards.length}</span>
        </div>
        {roundAwards.length === 0 ? (
          <StatusBanner>{t('roundAwardsEmpty')}</StatusBanner>
        ) : (
          <div className="round-awards-list">
            {roundAwards.map((award) => (
              <div key={`${award.playerId}-${award.levelAfter}-${award.xpAfter}`} className="round-award-card">
                <strong>{award.playerName}</strong>
                {award.medalIds.length > 0 ? (
                  <p>
                    {award.medalIds
                      .slice(0, 3)
                      .map((medalId) => getMedalDefinitionById(medalId)?.name ?? medalId)
                      .join('، ')}
                  </p>
                ) : (
                  <p>{t('roundAwardsNoMedals')}</p>
                )}
                {award.levelUps.length > 0 ? <p>{t('roundAwardsLevelUp', { level: award.levelAfter })}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <PrimaryActionBar className="sticky-action-bar" leading={<GameButton variant="ghost" onClick={() => navigate('/')}>{t('returnHome')}</GameButton>}>
        <GameButton variant="cta" size="lg" onClick={() => navigate('/play/setup')}>
          {t('quickReplay')}
        </GameButton>
      </PrimaryActionBar>
    </ScreenScaffold>
  );
}
