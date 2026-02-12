import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { GameButton } from '../components/GameButton';
import { getMedalDefinitionById } from '../lib/player-progression';
import { MedalIcon } from '../components/MedalIcon';
import { formatWordForDisplay } from '../lib/word-format';
import { playUiFeedback } from '../lib/ui-feedback';
import { useEffect, useRef } from 'react';

export function SummaryScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { matchId } = useParams<{ matchId?: string }>();

  const latestMatch = useLiveQuery(async () => {
    if (matchId) {
      return db.matches.get(matchId);
    }
    return db.matches.orderBy('endedAt').last();
  }, [matchId]);

  const cueRef = useRef('');
  useEffect(() => {
    if (!latestMatch) return;
    const key = latestMatch.id;
    if (cueRef.current === key) return;
    cueRef.current = key;
    playUiFeedback(latestMatch.result.winner === 'citizens' ? 'confirm' : 'danger', 1.14);
  }, [latestMatch]);

  if (!latestMatch) {
    return (
      <ScreenScaffold scroll="auto" title={t('roundSummary')} subtitle={t('summaryUnavailable')}>
        <GameButton variant="primary" size="lg" onClick={() => navigate('/')}>
          {t('returnHome')}
        </GameButton>
      </ScreenScaffold>
    );
  }

  const lang = i18n.language as 'en' | 'ar';
  const isCitizensWin = latestMatch.result.winner === 'citizens';
  const roundAwards = latestMatch.roundAwards ?? [];
  const word = formatWordForDisplay(
    lang === 'ar' ? latestMatch.wordTextAr : latestMatch.wordTextEn,
    lang,
  );

  const spyGuess = latestMatch.result.spyGuess
    ? formatWordForDisplay(latestMatch.result.spyGuess, lang)
    : null;

  const decoys = (lang === 'ar' ? latestMatch.decoysAr : latestMatch.decoysEn)
    .map((w) => formatWordForDisplay(w, lang));

  const dateStr = new Date(latestMatch.endedAt).toLocaleString(lang);
  const isFromHistory = Boolean(matchId);

  return (
    <div className="summary-page">
      <div className={`summary-hero ${isCitizensWin ? 'summary-hero--citizens' : 'summary-hero--spies'}`}>
        <div className="summary-hero__icon">{isCitizensWin ? '🛡️' : '🕵️'}</div>
        <h1 className="summary-hero__title">
          {isCitizensWin ? t('winnerCitizens') : t('winnerSpies')}
        </h1>
        <p className="summary-hero__date">{dateStr}</p>
      </div>

      <div className="summary-content">
        <section className="summary-section summary-word-section">
          <h2 className="summary-section__title">{t('correctWord')}</h2>
          <div className="summary-word-reveal">
            <span className="summary-word-main">{word}</span>
          </div>
          {spyGuess ? (
            <div className="summary-guess-row">
              <span className="summary-guess-label">{t('submitGuess')}:</span>
              <span className={`summary-guess-value ${latestMatch.result.spyGuessCorrect ? 'correct' : 'wrong'}`}>
                {spyGuess}
                <span className="summary-guess-icon">{latestMatch.result.spyGuessCorrect ? '✓' : '✗'}</span>
              </span>
            </div>
          ) : null}
          {decoys.length > 0 ? (
            <div className="summary-decoys">
              <span className="summary-decoys-label">{t('similarWords')}:</span>
              <div className="summary-decoys-list">
                {decoys.map((d, i) => (
                  <span key={i} className="summary-decoy-chip">{d}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {roundAwards.length > 0 ? (
          <section className="summary-section summary-awards-section">
            <h2 className="summary-section__title">{t('roundAwardsTitle')}</h2>
            <div className="summary-awards-grid">
              {roundAwards.map((award) => {
                const medals = award.medalIds
                  .slice(0, 3)
                  .map((id) => getMedalDefinitionById(id))
                  .filter(Boolean);

                return (
                  <div key={award.playerId} className="summary-award-card">
                    <div className="summary-award-header">
                      <strong className="summary-award-name">{award.playerName}</strong>
                      <span className="summary-award-xp">+{award.xpAfter} XP</span>
                    </div>
                    {medals.length > 0 ? (
                      <div className="summary-award-medals">
                        {medals.map((medal) => medal ? (
                          <span key={medal.id} className={`medal-chip medal-chip--${medal.tier}`}>
                            <MedalIcon tier={medal.tier} size={14} />
                            <span className="medal-chip__label">{medal.name}</span>
                          </span>
                        ) : null)}
                      </div>
                    ) : (
                      <p className="summary-award-no-medals">{t('roundAwardsNoMedals')}</p>
                    )}
                    {award.levelUps.length > 0 ? (
                      <div className="summary-award-levelup">
                        <span className="summary-levelup-text">{t('roundAwardsLevelUp', { level: award.levelAfter })}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="summary-actions">
          {isFromHistory ? (
            <GameButton variant="ghost" size="lg" onClick={() => navigate('/players?focus=history')}>
              {t('back')}
            </GameButton>
          ) : (
            <>
              <GameButton variant="ghost" size="lg" onClick={() => navigate('/')}>
                {t('returnHome')}
              </GameButton>
              <GameButton variant="cta" size="lg" onClick={() => navigate('/play/setup')}>
                {t('quickReplay')}
              </GameButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
