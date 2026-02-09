import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { db, ensureSettings } from '../lib/db';
import { updateGlobalSettings } from '../lib/game-repository';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { GameButton } from '../components/GameButton';
import { usePWAUpdate } from '../hooks/usePWAUpdate';
import type { ContrastPreset, HintMode, UiDensity, WordDifficulty } from '../types';

type UpdateStatus = 'idle' | 'checking' | 'up-to-date';

export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const { needRefresh, updateServiceWorker } = usePWAUpdate();

  useEffect(() => {
    void ensureSettings();
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (needRefresh) {
      await updateServiceWorker(true);
      return;
    }

    setUpdateStatus('checking');

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
        if (registration?.waiting) {
          setUpdateStatus('idle');
          return;
        }
      }

      setUpdateStatus('up-to-date');
      window.setTimeout(() => {
        setUpdateStatus('idle');
      }, 1800);
    } catch {
      setUpdateStatus('idle');
    }
  }, [needRefresh, updateServiceWorker]);

  if (!settings) {
    return null;
  }

  return (
    <ScreenScaffold title={t('globalSettings')} subtitle={t('settingsSubtitle')} eyebrow={t('settings')}>
      <section className="stack-list settings-section">
        <div className="section-heading section-heading--stack">
          <h2>{t('gameSettings')}</h2>
          <span className="subtle">{t('settingsGameplayHint')}</span>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>
              {t('discussionMinutes')} ({settings.discussionMinutes} {t('minutes')})
            </span>
            <input
              type="range"
              min={2}
              max={6}
              step={1}
              value={settings.discussionMinutes}
              onChange={(event) => void updateGlobalSettings({ discussionMinutes: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>
              {t('guessSeconds')} ({settings.guessSeconds} {t('seconds')})
            </span>
            <input
              type="range"
              min={15}
              max={60}
              step={5}
              value={settings.guessSeconds}
              onChange={(event) => void updateGlobalSettings({ guessSeconds: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>{t('wordDifficulty')}</span>
            <select
              value={settings.wordDifficulty}
              onChange={(event) => void updateGlobalSettings({ wordDifficulty: event.target.value as WordDifficulty })}
            >
              <option value="any">{t('difficultyAny')}</option>
              <option value="easy">{t('difficultyEasy')}</option>
              <option value="medium">{t('difficultyMedium')}</option>
              <option value="hard">{t('difficultyHard')}</option>
            </select>
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>{t('hintMode')}</span>
            <select
              value={settings.hintMode}
              onChange={(event) => void updateGlobalSettings({ hintMode: event.target.value as HintMode })}
            >
              <option value="weak">{t('hintWeak')}</option>
              <option value="normal">{t('hintNormal')}</option>
              <option value="off">{t('hintOff')}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="stack-list settings-section">
        <div className="section-heading section-heading--stack">
          <h2>{t('displaySettings')}</h2>
          <span className="subtle">{t('themeLocked')}</span>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>{t('uiScale')} ({settings.uiScale.toFixed(2)}x)</span>
            <input
              type="range"
              min={0.85}
              max={1.2}
              step={0.05}
              value={settings.uiScale}
              onChange={(event) => void updateGlobalSettings({ uiScale: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>{t('animationSpeed')} ({settings.animationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={settings.animationSpeed}
              onChange={(event) => void updateGlobalSettings({ animationSpeed: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="switch-row">
            <span>{t('reducedMotion')}</span>
            <input
              type="checkbox"
              checked={settings.reducedMotionMode}
              onChange={(event) => void updateGlobalSettings({ reducedMotionMode: event.target.checked })}
            />
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>{t('contrastPreset')}</span>
            <select
              value={settings.contrastPreset}
              onChange={(event) => void updateGlobalSettings({ contrastPreset: event.target.value as ContrastPreset })}
            >
              <option value="normal">{t('contrastNormal')}</option>
              <option value="high">{t('contrastHigh')}</option>
            </select>
          </label>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="form-field">
            <span>{t('uiDensity')}</span>
            <select value={settings.uiDensity} onChange={(event) => void updateGlobalSettings({ uiDensity: event.target.value as UiDensity })}>
              <option value="comfortable">{t('densityComfortable')}</option>
              <option value="compact">{t('densityCompact')}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="stack-list settings-section">
        <div className="section-heading">
          <h2>{t('audioSettings')}</h2>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <label className="switch-row">
            <span>{t('sound')}</span>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => void updateGlobalSettings({ soundEnabled: event.target.checked })}
            />
          </label>
        </div>
      </section>

      <section className="stack-list settings-section">
        <div className="section-heading">
          <h2>{t('systemSettings')}</h2>
        </div>

        <div className="glass-card setting-card cinematic-panel section-card">
          <GameButton
            variant="primary"
            size="md"
            className={`update-check-btn ${needRefresh ? 'game-button--update-available' : ''}`}
            icon={<RefreshCw size={18} aria-hidden />}
            onClick={() => void checkForUpdates()}
            disabled={updateStatus === 'checking'}
          >
            {updateStatus === 'checking'
              ? t('checking')
              : needRefresh
                ? t('updateAvailable')
                : updateStatus === 'up-to-date'
                  ? t('upToDate')
                  : t('checkForUpdates')}
          </GameButton>
        </div>
      </section>
    </ScreenScaffold>
  );
}
