import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import type {
  AiHumanMode,
  AiReplyLength,
  GlobalSettings,
} from '../../types';
import { updateGlobalSettings } from '../../lib/game-repository';
import { GameButton } from '../../components/GameButton';
import { StatusBanner } from '../../components/StatusBanner';
import type { AsyncStatus } from './types';

interface AiSettingsSectionProps {
  settings: GlobalSettings;
  aiTestStatus: AsyncStatus;
  aiTestMessage: string;
  elevenStatus: AsyncStatus;
  elevenMessage: string;
  elevenVoiceTestStatus: AsyncStatus;
  elevenVoiceTestMessage: string;
  onTestAiConnection: () => void;
  onTestElevenConnection: () => void;
  onTestElevenSpeech: () => void;
}

export function AiSettingsSection({
  settings,
  aiTestStatus,
  aiTestMessage,
  elevenStatus,
  elevenMessage,
  elevenVoiceTestStatus,
  elevenVoiceTestMessage,
  onTestAiConnection,
  onTestElevenConnection,
  onTestElevenSpeech,
}: AiSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="stack-list settings-section">
      <div className="section-heading section-heading--stack">
        <h2><Bot size={20} className="section-icon" aria-hidden /> {t('aiSettings')}</h2>
        <span className="subtle">{t('aiSettingsHint')}</span>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="switch-row">
          <span>{t('aiEnabled')}</span>
          <input
            type="checkbox"
            checked={settings.aiEnabled}
            onChange={(event) => void updateGlobalSettings({ aiEnabled: event.target.checked })}
          />
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>{t('aiHumanMode')}</span>
          <select
            value={settings.aiHumanMode}
            onChange={(event) => {
              const nextMode = event.target.value as AiHumanMode;
              void updateGlobalSettings({
                aiHumanMode: nextMode,
                ...(nextMode !== 'ultra' ? { aiHumanSimulationEnabled: false } : {}),
              });
            }}
          >
            <option value="strategic">{t('aiHumanModeStrategic')}</option>
            <option value="natural">{t('aiHumanModeNatural')}</option>
            <option value="ultra">{t('aiHumanModeUltra')}</option>
          </select>
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="switch-row">
          <span>{t('aiHumanSimulation')}</span>
          <input
            type="checkbox"
            checked={settings.aiHumanSimulationEnabled}
            disabled={settings.aiHumanMode !== 'ultra'}
            onChange={(event) => void updateGlobalSettings({ aiHumanSimulationEnabled: event.target.checked })}
          />
        </label>
        <p className="subtle">{t('aiHumanSimulationHint')}</p>
        {settings.aiHumanMode !== 'ultra' ? (
          <StatusBanner tone="warning">{t('aiHumanSimulationRequiresUltra')}</StatusBanner>
        ) : settings.aiHumanSimulationEnabled ? (
          <StatusBanner tone="success">{t('aiHumanSimulationEnabledBadge')}</StatusBanner>
        ) : null}
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>
            {t('aiReasoningDepth')} ({t('aiDepthLevel', { level: settings.aiReasoningDepth })})
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={settings.aiReasoningDepth}
            onChange={(event) => void updateGlobalSettings({ aiReasoningDepth: Number(event.target.value) as 1 | 2 | 3 })}
          />
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>{t('aiReplyLength')}</span>
          <select value={settings.aiReplyLength} onChange={(event) => void updateGlobalSettings({ aiReplyLength: event.target.value as AiReplyLength })}>
            <option value="short">{t('aiReplyLengthShort')}</option>
            <option value="balanced">{t('aiReplyLengthBalanced')}</option>
            <option value="detailed">{t('aiReplyLengthDetailed')}</option>
          </select>
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>
            {t('aiInitiativeLevel')} ({t('aiInitiativeValue', { value: settings.aiInitiativeLevel })})
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.aiInitiativeLevel}
            onChange={(event) => void updateGlobalSettings({ aiInitiativeLevel: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>
            {t('aiMemoryDepth')} ({t('aiMemoryTurns', { value: settings.aiMemoryDepth })})
          </span>
          <input
            type="range"
            min={8}
            max={24}
            step={2}
            value={settings.aiMemoryDepth}
            onChange={(event) => void updateGlobalSettings({ aiMemoryDepth: Number(event.target.value) })}
          />
        </label>
      </div>

      <StatusBanner tone="default">{t('aiServerManaged')}</StatusBanner>

      <div className="glass-card setting-card cinematic-panel section-card">
        <div className="actions-row">
          <GameButton
            variant="primary"
            size="md"
            onClick={onTestAiConnection}
            disabled={aiTestStatus === 'testing' || !settings.aiEnabled}
          >
            {aiTestStatus === 'testing' ? t('aiTesting') : t('aiTestConnection')}
          </GameButton>
        </div>

        {aiTestStatus !== 'idle' ? (
          <StatusBanner tone={aiTestStatus === 'success' ? 'success' : aiTestStatus === 'error' ? 'danger' : 'default'}>
            {aiTestMessage || (aiTestStatus === 'success' ? t('aiTestOk') : aiTestStatus === 'testing' ? t('aiTesting') : t('aiTestFail'))}
          </StatusBanner>
        ) : null}
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <div className="section-heading section-heading--stack">
          <h2>{t('elevenSettingsTitle')}</h2>
          <span className="subtle">{t('elevenSettingsHint')}</span>
        </div>
        <div className="actions-row">
          <GameButton
            variant="primary"
            size="md"
            onClick={onTestElevenConnection}
            disabled={elevenStatus === 'testing'}
          >
            {elevenStatus === 'testing' ? t('elevenTesting') : t('elevenConnectionTest')}
          </GameButton>

          <GameButton
            variant="ghost"
            size="md"
            onClick={onTestElevenSpeech}
            disabled={elevenVoiceTestStatus === 'testing' || !settings.soundEnabled || !settings.aiVoiceOutputEnabled}
          >
            {elevenVoiceTestStatus === 'testing' ? t('elevenVoiceTesting') : t('elevenVoiceTest')}
          </GameButton>
        </div>

        {elevenStatus !== 'idle' ? (
          <StatusBanner tone={elevenStatus === 'success' ? 'success' : elevenStatus === 'error' ? 'danger' : 'default'}>
            {elevenMessage ||
              (elevenStatus === 'success' ? t('elevenConnectionOk') : elevenStatus === 'testing' ? t('elevenTesting') : t('elevenConnectionFail'))}
          </StatusBanner>
        ) : null}

        {elevenVoiceTestStatus !== 'idle' ? (
          <StatusBanner
            tone={
              elevenVoiceTestStatus === 'success' ? 'success' : elevenVoiceTestStatus === 'error' ? 'danger' : 'default'
            }
          >
            {elevenVoiceTestMessage ||
              (elevenVoiceTestStatus === 'success'
                ? t('elevenVoiceTestOk')
                : elevenVoiceTestStatus === 'testing'
                  ? t('elevenVoiceTesting')
                  : t('elevenVoiceTestFail'))}
          </StatusBanner>
        ) : null}
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="switch-row">
          <span>{t('aiVoiceInput')}</span>
          <input
            type="checkbox"
            checked={settings.aiVoiceInputEnabled}
            onChange={(event) => void updateGlobalSettings({ aiVoiceInputEnabled: event.target.checked })}
          />
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="switch-row">
          <span>{t('aiVoiceOutput')}</span>
          <input
            type="checkbox"
            checked={settings.aiVoiceOutputEnabled}
            onChange={(event) => void updateGlobalSettings({ aiVoiceOutputEnabled: event.target.checked })}
          />
        </label>
        <p className="subtle">{t('aiVoiceNote')}</p>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>{t('aiVoiceProvider')}</span>
          <select value="elevenlabs" disabled>
            <option value="elevenlabs">{t('aiVoiceProviderEleven')}</option>
          </select>
        </label>
        <p className="subtle">{t('aiVoiceProviderLocked')}</p>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="switch-row">
          <span>{t('aiAutoFacilitatorEnabled')}</span>
          <input
            type="checkbox"
            checked={settings.aiAutoFacilitatorEnabled}
            onChange={(event) => void updateGlobalSettings({ aiAutoFacilitatorEnabled: event.target.checked })}
          />
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>
            {t('aiSilenceThreshold')} ({Math.round(settings.aiSilenceThresholdMs / 1000)} {t('seconds')})
          </span>
          <input
            type="range"
            min={3000}
            max={12000}
            step={500}
            value={settings.aiSilenceThresholdMs}
            onChange={(event) => void updateGlobalSettings({ aiSilenceThresholdMs: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <label className="form-field">
          <span>
            {t('aiInterventionRest')} ({Math.round(settings.aiInterventionRestMs / 1000)} {t('seconds')})
          </span>
          <input
            type="range"
            min={4000}
            max={20000}
            step={1000}
            value={settings.aiInterventionRestMs}
            onChange={(event) => void updateGlobalSettings({ aiInterventionRestMs: Number(event.target.value) })}
          />
        </label>
      </div>
    </section>
  );
}
