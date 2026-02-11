import { useTranslation } from 'react-i18next';
import type { ContrastPreset, GlobalSettings, UiDensity } from '../../types';
import { updateGlobalSettings } from '../../lib/game-repository';
import { GameButton } from '../../components/GameButton';
import { StatusBanner } from '../../components/StatusBanner';
import type { AsyncStatus, BannerTone } from './types';

interface DisplaySettingsSectionProps {
  settings: GlobalSettings;
  selfHealStatus: AsyncStatus;
  selfHealMessage: string;
  selfHealTone: BannerTone;
  onRunSelfHeal: () => void;
}

export function DisplaySettingsSection({
  settings,
  selfHealStatus,
  selfHealMessage,
  selfHealTone,
  onRunSelfHeal,
}: DisplaySettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  return (
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

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="switch-row">
          <span>{t('uiAutoFixEnabled')}</span>
          <input
            type="checkbox"
            checked={settings.uiAutoFixEnabled}
            onChange={(event) => void updateGlobalSettings({ uiAutoFixEnabled: event.target.checked })}
          />
        </label>
        <p className="subtle">{t('uiAutoFixHint')}</p>
        <div className="actions-row ui-debugger-actions">
          <GameButton
            variant="primary"
            size="md"
            onClick={onRunSelfHeal}
            disabled={selfHealStatus === 'testing'}
          >
            {selfHealStatus === 'testing' ? t('uiSelfHealRunning') : t('uiSelfHealRun')}
          </GameButton>
        </div>
        {settings.uiSelfHealLastRunAt ? (
          <StatusBanner>
            {t('uiSelfHealLastRun', {
              score: settings.uiSelfHealScore ?? 0,
              time: new Date(settings.uiSelfHealLastRunAt).toLocaleString(locale),
            })}
          </StatusBanner>
        ) : null}
        {selfHealStatus !== 'idle' ? (
          <StatusBanner tone={selfHealStatus === 'error' ? 'danger' : selfHealTone}>
            {selfHealMessage ||
              (selfHealStatus === 'success'
                ? t('uiSelfHealDone', { score: settings.uiSelfHealScore ?? 0 })
                : selfHealStatus === 'testing'
                  ? t('uiSelfHealRunning')
                  : t('uiSelfHealFail'))}
          </StatusBanner>
        ) : null}
      </div>
    </section>
  );
}
