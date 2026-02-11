import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { db, ensureSettings } from '../lib/db';
import { updateGlobalSettings } from '../lib/game-repository';
import { chatComplete, DeepSeekError } from '../lib/ai/deepseek-client';
import { ElevenError, speakWithEleven } from '../lib/ai/eleven-client';
import {
  analyzeUiHealth,
  buildUiAuditPrompt,
  buildUiSelfHealPersistedPatch,
  buildUiSelfHealSummary,
  collectUiDiagnosticsContext,
  shouldPersistUiSelfHeal,
} from '../lib/ui-self-heal';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { usePWAUpdate } from '../hooks/usePWAUpdate';
import type { GlobalSettings, HintMode, WordDifficulty } from '../types';
import { DisplaySettingsSection } from './settings/DisplaySettingsSection';
import { AiSettingsSection } from './settings/AiSettingsSection';
import { SystemSettingsSection } from './settings/SystemSettingsSection';
import type { AsyncStatus, BannerTone } from './settings/types';

type UpdateStatus = 'idle' | 'checking' | 'up-to-date';

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
  const [selfHealTone, setSelfHealTone] = useState<BannerTone>('default');
  const { needRefresh, updateServiceWorker } = usePWAUpdate();

  useEffect(() => {
    void ensureSettings();
  }, []);

  useEffect(() => {
    if (needRefresh) {
      return;
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
      await chatComplete({
        model: settings.aiModel,
        messages: [
          { role: 'system', content: 'Reply only with "pong".' },
          { role: 'user', content: 'ping' },
        ],
        temperature: 0,
        maxTokens: 8,
        timeoutMs: 10_000,
      });

      setAiTestStatus('success');
      setAiTestMessage(t('aiTestOk'));
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
      if (!patch) {
        return changes;
      }
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
    const tone: BannerTone =
      result.report.score >= 85 ? 'success' : result.report.score >= 65 ? 'warning' : 'danger';
    const persistedPatch = buildUiSelfHealPersistedPatch(result);

    try {
      if (shouldPersistUiSelfHeal(settings, result, { mode: 'manual' })) {
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

      <DisplaySettingsSection
        settings={settings}
        selfHealStatus={selfHealStatus}
        selfHealMessage={selfHealMessage}
        selfHealTone={selfHealTone}
        onRunSelfHeal={() => void runUiSelfHeal()}
      />

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

      <AiSettingsSection
        settings={settings}
        aiTestStatus={aiTestStatus}
        aiTestMessage={aiTestMessage}
        elevenStatus={elevenStatus}
        elevenMessage={elevenMessage}
        elevenVoiceTestStatus={elevenVoiceTestStatus}
        elevenVoiceTestMessage={elevenVoiceTestMessage}
        onTestAiConnection={() => void testAiConnection()}
        onTestElevenConnection={() => void testElevenConnection()}
        onTestElevenSpeech={() => void testElevenSpeech()}
      />

      <SystemSettingsSection
        settings={settings}
        needRefresh={needRefresh}
        updateStatus={updateStatus}
        onCheckForUpdates={() => void checkForUpdates()}
      />
    </ScreenScaffold>
  );
}
