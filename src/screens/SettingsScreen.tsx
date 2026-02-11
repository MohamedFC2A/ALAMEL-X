import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { db, ensureSettings } from '../lib/db';
import { updateGlobalSettings } from '../lib/game-repository';
import { chatComplete, DeepSeekError } from '../lib/ai/deepseek-client';
import { ElevenError, speakWithEleven } from '../lib/ai/eleven-client';
import {
  analyzeUiHealth,
  buildUiAuditPrompt,
  buildUiSelfHealSummary,
  collectUiDiagnosticsContext,
  hasUiSelfHealPatch,
} from '../lib/ui-self-heal';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { GameButton } from '../components/GameButton';
import { StatusBanner } from '../components/StatusBanner';
import { usePWAUpdate } from '../hooks/usePWAUpdate';
import type {
  AiHumanMode,
  AiReplyLength,
  ContrastPreset,
  GlobalSettings,
  HintMode,
  UiDensity,
  WordDifficulty,
} from '../types';

type UpdateStatus = 'idle' | 'checking' | 'up-to-date';
type AsyncStatus = 'idle' | 'testing' | 'success' | 'error';

interface ElevenVoicePreview {
  id: string;
  name: string;
  category?: string;
  language?: string;
}

interface ElevenHealthResponse {
  ok: boolean;
  provider?: string;
  modelId?: string;
  configuredVoiceId?: string | null;
  selectedVoice?: ElevenVoicePreview;
  voicesCount?: number;
  voicesPreview?: ElevenVoicePreview[];
  error?: {
    message?: string;
    code?: string;
    details?: string;
  };
}

function randomItem<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function formatElevenError(error: unknown, fallback: string): string {
  if (error instanceof ElevenError) {
    const status = error.status ? ` (status ${error.status})` : '';
    return `${error.message}${status}`;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [aiTestStatus, setAiTestStatus] = useState<AsyncStatus>('idle');
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [elevenStatus, setElevenStatus] = useState<AsyncStatus>('idle');
  const [elevenMessage, setElevenMessage] = useState('');
  const [elevenVoiceTestStatus, setElevenVoiceTestStatus] = useState<AsyncStatus>('idle');
  const [elevenVoiceTestMessage, setElevenVoiceTestMessage] = useState('');
  const [selfHealStatus, setSelfHealStatus] = useState<AsyncStatus>('idle');
  const [selfHealMessage, setSelfHealMessage] = useState('');
  const [selfHealTone, setSelfHealTone] = useState<'default' | 'success' | 'warning' | 'danger'>('default');
  const { needRefresh, updateServiceWorker } = usePWAUpdate();

  useEffect(() => {
    void ensureSettings();
  }, []);

  // Auto-check for updates when entering settings
  useEffect(() => {
    if (needRefresh) {
      return; // Already detected
    }
    const silentCheck = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          await registration?.update();
        }
      } catch {
        // ignore
      }
    };
    void silentCheck();
  }, [needRefresh]);

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

  const testAiConnection = useCallback(async () => {
    if (!settings) {
      return;
    }

    if (!settings.aiEnabled) {
      setAiTestStatus('error');
      setAiTestMessage(t('aiDisabled'));
      return;
    }

    setAiTestStatus('testing');
    setAiTestMessage('');

    try {
      const text = await chatComplete({
        model: settings.aiModel,
        messages: [
          { role: 'system', content: 'Reply only with "pong".' },
          { role: 'user', content: 'ping' },
        ],
        temperature: 0,
        maxTokens: 8,
        timeoutMs: 10_000,
      });

      if (text.toLowerCase().includes('pong')) {
        setAiTestStatus('success');
        setAiTestMessage(t('aiTestOk'));
      } else {
        setAiTestStatus('success');
        setAiTestMessage(t('aiTestOk'));
      }
    } catch (error) {
      if (error instanceof DeepSeekError) {
        const msg =
          error.kind === 'auth'
            ? t('aiAuthError')
            : error.kind === 'rate_limit'
              ? t('aiRateLimitError')
              : error.kind === 'network'
                ? t('aiNetworkError')
                : t('aiUnknownError');
        setAiTestStatus('error');
        setAiTestMessage(msg);
      } else {
        setAiTestStatus('error');
        setAiTestMessage(t('aiUnknownError'));
      }
    }
  }, [settings, t]);

  const fetchElevenHealth = useCallback(async (): Promise<ElevenHealthResponse> => {
    const response = await fetch('/api/eleven/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const payload = await parseJsonSafe<ElevenHealthResponse>(response);
    const contentType = response.headers?.get?.('content-type')?.toLowerCase?.() ?? '';

    if (!payload) {
      const runtimeHint = contentType.includes('text/html')
        ? 'غالبًا endpoint /api غير شغال في البيئة الحالية. شغّل التطبيق عبر Vercel dev أو انشره على Vercel.'
        : 'الرد غير متوقع من endpoint الصحة.';
      throw new Error(`ElevenLabs health failed (${response.status}). ${runtimeHint}`);
    }

    if (!response.ok || !payload.ok) {
      const errorMessage = payload?.error?.message || `ElevenLabs health failed (${response.status}).`;
      const code = payload?.error?.code ? `code=${payload.error.code}` : '';
      const details = payload?.error?.details ? ` | details=${String(payload.error.details).slice(0, 500)}` : '';
      throw new Error(`${errorMessage}${code ? ` | ${code}` : ''}${details}`);
    }

    return payload;
  }, []);

  const testElevenConnection = useCallback(async () => {
    setElevenStatus('testing');
    setElevenMessage('');
    try {
      const health = await fetchElevenHealth();
      const selected = health.selectedVoice;
      const voiceLabel = selected?.name ? `${selected.name} (${selected.id})` : t('elevenUnknownVoice');
      const count = typeof health.voicesCount === 'number' ? health.voicesCount : 0;
      const model = health.modelId || '-';
      setElevenStatus('success');
      setElevenMessage(t('elevenConnectionOkDetailed', { voice: voiceLabel, count, model }));
    } catch (error) {
      setElevenStatus('error');
      setElevenMessage(formatElevenError(error, t('elevenConnectionFail')));
    }
  }, [fetchElevenHealth, t]);

  const testElevenSpeech = useCallback(async () => {
    if (!settings?.soundEnabled || !settings.aiVoiceOutputEnabled) {
      setElevenVoiceTestStatus('error');
      setElevenVoiceTestMessage(t('elevenVoiceTestNeedOutput'));
      return;
    }

    setElevenVoiceTestStatus('testing');
    setElevenVoiceTestMessage('');

    try {
      const health = await fetchElevenHealth();
      const voices = health.voicesPreview ?? [];
      const selectedVoice = randomItem(voices) ?? health.selectedVoice;
      const selectedVoiceId = selectedVoice?.id;
      const selectedVoiceName = selectedVoice?.name || t('elevenUnknownVoice');

      const samples = [
        'اختبار صوت ElevenLabs. لو سامعني يبقى كل حاجة تمام.',
        'تمام كده، الصوت شغال من إعدادات اللعبة.',
        'ده اختبار عشوائي للصوت من ElevenLabs داخل اللعبة.',
      ];
      const sample = randomItem(samples) ?? samples[0];

      await speakWithEleven({
        text: sample,
        voiceId: selectedVoiceId,
      });

      setElevenVoiceTestStatus('success');
      setElevenVoiceTestMessage(t('elevenVoiceTestOkDetailed', { voice: selectedVoiceName, voiceId: selectedVoiceId || '-' }));
    } catch (error) {
      setElevenVoiceTestStatus('error');
      setElevenVoiceTestMessage(formatElevenError(error, t('elevenVoiceTestFail')));
    }
  }, [fetchElevenHealth, settings, t]);

  const describePatch = useCallback(
    (patch: Partial<GlobalSettings>): string[] => {
      const changes: string[] = [];
      if (patch.uiScale !== undefined) {
        changes.push(`${t('uiScale')}: ${patch.uiScale.toFixed(2)}x`);
      }
      if (patch.uiDensity) {
        changes.push(`${t('uiDensity')}: ${patch.uiDensity === 'compact' ? t('densityCompact') : t('densityComfortable')}`);
      }
      if (patch.animationSpeed !== undefined) {
        changes.push(`${t('animationSpeed')}: ${patch.animationSpeed.toFixed(2)}x`);
      }
      if (patch.reducedMotionMode !== undefined) {
        changes.push(`${t('reducedMotion')}: ${patch.reducedMotionMode ? t('on') : t('off')}`);
      }
      return changes;
    },
    [t],
  );

  const runUiSelfHeal = useCallback(async () => {
    if (!settings) {
      return;
    }

    setSelfHealStatus('testing');
    setSelfHealMessage('');
    setSelfHealTone('default');

    const context = collectUiDiagnosticsContext();
    const result = analyzeUiHealth(settings, context);
    const changes = describePatch(result.patch);
    const tone: 'success' | 'warning' | 'danger' =
      result.report.score >= 85 ? 'success' : result.report.score >= 65 ? 'warning' : 'danger';

    const persistedPatch: Partial<GlobalSettings> = {
      ...result.patch,
      uiSelfHealScore: result.report.score,
      uiSelfHealLastRunAt: result.report.checkedAt,
    };

    try {
      if (hasUiSelfHealPatch(result.patch) || settings.uiSelfHealScore !== result.report.score) {
        await updateGlobalSettings(persistedPatch);
      }

      let message = `${t('uiSelfHealDone', { score: result.report.score })}\n`;
      message += changes.length
        ? `${t('uiSelfHealApplied')}: ${changes.join(' | ')}`
        : t('uiSelfHealNoChanges');

      if (settings.aiEnabled) {
        try {
          const insight = await chatComplete({
            model: settings.aiModel,
            messages: [
              { role: 'system', content: 'You are a senior mobile UI engineer. Keep response concise.' },
              { role: 'user', content: buildUiAuditPrompt(result.report) },
            ],
            temperature: 0.2,
            maxTokens: 180,
            timeoutMs: 10_000,
          });
          if (insight.trim()) {
            message += `\n${t('uiSelfHealAiInsight')}: ${insight.trim()}`;
          }
        } catch {
          message += `\n${t('uiSelfHealAiInsightUnavailable')}`;
        }
      }

      setSelfHealTone(tone);
      setSelfHealStatus('success');
      setSelfHealMessage(`${message}\n${buildUiSelfHealSummary(result)}`);
    } catch (error) {
      setSelfHealStatus('error');
      setSelfHealTone('danger');
      if (error instanceof DeepSeekError) {
        setSelfHealMessage(error.message || t('uiSelfHealFail'));
      } else if (error instanceof Error) {
        setSelfHealMessage(error.message || t('uiSelfHealFail'));
      } else {
        setSelfHealMessage(t('uiSelfHealFail'));
      }
    }
  }, [describePatch, settings, t]);

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
          <div className="actions-row">
            <GameButton
              variant="primary"
              size="md"
              onClick={() => void runUiSelfHeal()}
              disabled={selfHealStatus === 'testing'}
            >
              {selfHealStatus === 'testing' ? t('uiSelfHealRunning') : t('uiSelfHealRun')}
            </GameButton>
          </div>
          {settings.uiSelfHealLastRunAt ? (
            <StatusBanner>
              {t('uiSelfHealLastRun', {
                score: settings.uiSelfHealScore ?? 0,
                time: new Date(settings.uiSelfHealLastRunAt).toLocaleString('ar'),
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
        <div className="section-heading section-heading--stack">
          <h2>{t('aiSettings')}</h2>
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
              onClick={() => void testAiConnection()}
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
              onClick={() => void testElevenConnection()}
              disabled={elevenStatus === 'testing'}
            >
              {elevenStatus === 'testing' ? t('elevenTesting') : t('elevenConnectionTest')}
            </GameButton>

            <GameButton
              variant="ghost"
              size="md"
              onClick={() => void testElevenSpeech()}
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
