import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Mic, Volume2, X } from 'lucide-react';
import type { ActiveMatch, AiThreadState, GlobalSettings, Language, Player } from '../types';
import { db } from '../lib/db';
import { updateActiveMatch } from '../lib/game-repository';
import { DeepSeekError } from '../lib/ai/deepseek-client';
import { generateChatReply, runtimeConfigFromSettings } from '../lib/ai/agent';
import { StatusBanner } from './StatusBanner';
import { GameButton } from './GameButton';

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface AiDeskModalProps {
  open: boolean;
  onClose: () => void;
  activeMatch: ActiveMatch;
  aiPlayers: Player[];
  playerMap: Map<string, Player>;
  settings: GlobalSettings | undefined;
  language: Language;
}

function buildEmptyThread(): AiThreadState {
  return { messages: [], summary: '' };
}

function formatAiError(error: unknown, t: (key: string) => string): string {
  if (error instanceof DeepSeekError) {
    if (error.kind === 'auth') return t('aiAuthError');
    if (error.kind === 'rate_limit') return t('aiRateLimitError');
    if (error.kind === 'network') return t('aiNetworkError');
    return t('aiUnknownError');
  }
  return t('aiUnknownError');
}

function buildContext(activeMatch: ActiveMatch, aiPlayer: Player, language: Language, playerMap: Map<string, Player>) {
  const isSpy = activeMatch.match.spyIds.includes(aiPlayer.id);
  const role = isSpy ? 'spy' : 'citizen';
  const secretWord = role === 'citizen' ? (language === 'ar' ? activeMatch.wordTextAr : activeMatch.wordTextEn) : undefined;
  const spyHintText = role === 'spy' ? (language === 'ar' ? activeMatch.spyHintAr : activeMatch.spyHintEn) : undefined;
  const spyTeammateNames =
    role === 'spy'
      ? activeMatch.match.spyIds
          .filter((id) => id !== aiPlayer.id)
          .map((id) => playerMap.get(id)?.name ?? id)
      : [];

  return {
    language,
    aiPlayer: { id: aiPlayer.id, name: aiPlayer.name },
    role,
    category: activeMatch.match.category,
    secretWord,
    spyHintText,
    spyTeammateNames,
  } as const;
}

function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0610-\u061a\u06d6-\u06ed]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWakePhrase(text: string, aiName: string): string {
  const escaped = aiName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^\\s*(يا\\s*)?${escaped}[،,:\\-\\s]*`, 'i'), '').trim();
}

function resolveAiTarget(utterance: string, aiPlayers: Player[]): Player | null {
  if (!aiPlayers.length) {
    return null;
  }
  if (aiPlayers.length === 1) {
    return aiPlayers[0];
  }

  const normalizedInput = normalizeSpeechText(utterance);
  let best: { player: Player; score: number } | null = null;

  for (const player of aiPlayers) {
    const normalizedName = normalizeSpeechText(player.name);
    if (!normalizedName) {
      continue;
    }

    let score = 0;
    if (normalizedInput.includes(normalizedName)) {
      score += 10;
    }

    const tokens = normalizedName.split(' ').filter((token) => token.length >= 2);
    for (const token of tokens) {
      if (normalizedInput.includes(token)) {
        score += 2;
      }
    }

    if (!best || score > best.score) {
      best = { player, score };
    }
  }

  if (best && best.score > 0) {
    return best.player;
  }

  return aiPlayers[0];
}

function pickBestVoice(language: Language): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return undefined;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return undefined;
  }

  const langPrefix = language === 'ar' ? 'ar' : 'en';
  const preferredName = language === 'ar' ? ['google', 'premium', 'neural', 'arabic'] : ['google', 'premium', 'neural'];
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
  const pool = candidates.length ? candidates : voices;

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const voice of pool) {
    const name = voice.name.toLowerCase();
    let score = 0;
    if (voice.lang.toLowerCase().startsWith(langPrefix)) score += 5;
    if (voice.localService) score += 2;
    if (preferredName.some((entry) => name.includes(entry))) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best;
}

function speakText(text: string, language: Language) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    utterance.voice = pickBestVoice(language) ?? null;
    utterance.rate = language === 'ar' ? 1.17 : 1.08;
    utterance.pitch = 0.96;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore
  }
}

export function AiDeskModal({ open, onClose, activeMatch, aiPlayers, playerMap, settings, language }: AiDeskModalProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listening = status === 'listening';

  const aiNames = useMemo(() => aiPlayers.map((player) => player.name).join('، '), [aiPlayers]);

  useEffect(() => {
    if (!open) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setStatus('idle');
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      const current = await db.activeMatch.get('active');
      if (!current) {
        return;
      }

      const ids = aiPlayers.map((player) => player.id);
      const existingThreads = current.ai?.threads ?? {};
      const threads = { ...existingThreads };
      for (const id of ids) {
        if (!threads[id]) {
          threads[id] = buildEmptyThread();
        }
      }

      await updateActiveMatch({
        ai: {
          playerIds: ids,
          threads,
        },
      });
    })();
  }, [aiPlayers, open]);

  const canUseAi = Boolean(settings?.aiEnabled && settings.aiApiKey?.trim());
  const canVoiceIn = Boolean(settings?.aiVoiceInputEnabled);
  const canVoiceOut = Boolean(settings?.aiVoiceOutputEnabled && settings?.soundEnabled);

  async function appendMessages(aiId: string, messagesToAppend: Array<{ from: 'user' | 'ai'; text: string }>) {
    const current = await db.activeMatch.get('active');
    if (!current) {
      return;
    }

    const ids = current.ai?.playerIds?.length ? current.ai.playerIds : aiPlayers.map((player) => player.id);
    const existingThreads = current.ai?.threads ?? {};
    const baseThread = existingThreads[aiId] ?? buildEmptyThread();
    const appended = messagesToAppend.map((message) => ({ ...message, at: Date.now() }));
    const nextThread: AiThreadState = {
      ...baseThread,
      messages: [...(baseThread.messages ?? []), ...appended],
    };

    await updateActiveMatch({
      ai: {
        playerIds: ids,
        threads: {
          ...existingThreads,
          [aiId]: nextThread,
        },
      },
    });
  }

  async function handleVoiceCommand(utterance: string) {
    const targetAi = resolveAiTarget(utterance, aiPlayers);
    if (!targetAi) {
      return;
    }

    if (!settings?.aiEnabled) {
      setError(t('aiDisabled'));
      return;
    }

    if (!canUseAi) {
      setError(t('aiSetupRequired'));
      return;
    }

    const cleanedText = stripWakePhrase(utterance, targetAi.name);
    if (!cleanedText) {
      setError(t('aiVoiceNeedPrompt'));
      return;
    }

    setError('');
    setStatus('processing');

    try {
      const config = runtimeConfigFromSettings(settings);
      const context = buildContext(activeMatch, targetAi, language, playerMap);
      const baseThread = activeMatch.ai?.threads?.[targetAi.id] ?? buildEmptyThread();

      await appendMessages(targetAi.id, [{ from: 'user', text: cleanedText }]);
      const { reply } = await generateChatReply(config, context, baseThread, cleanedText);
      await appendMessages(targetAi.id, [{ from: 'ai', text: reply }]);

      if (canVoiceOut) {
        speakText(reply, language);
      }
    } catch (err) {
      setError(formatAiError(err, t));
    } finally {
      setStatus('idle');
    }
  }

  function startListening() {
    if (!canVoiceIn) {
      setError(t('aiVoiceInputDisabled'));
      return;
    }
    if (status !== 'idle') {
      return;
    }

    const windowWithSpeech = window as unknown as SpeechRecognitionWindow;
    const SpeechRecognitionCtor = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError(t('aiVoiceUnsupported'));
      return;
    }

    setError('');
    setStatus('listening');

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    let finalText = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const startIndex = event.resultIndex ?? 0;
      const results = event.results ?? [];
      for (let i = startIndex; i < results.length; i += 1) {
        const transcript = results[i]?.[0]?.transcript?.toString().trim() ?? '';
        if (!transcript) {
          continue;
        }
        const isFinal = Boolean((results as unknown as ArrayLike<{ isFinal?: boolean }>)[i]?.isFinal);
        if (isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        }
      }
    };

    recognition.onerror = () => {
      setError(t('aiVoiceError'));
      setStatus('idle');
    };

    recognition.onend = () => {
      setStatus('idle');
      if (finalText.trim()) {
        void handleVoiceCommand(finalText.trim());
        return;
      }
      setError(t('aiVoiceNoSpeech'));
    };

    try {
      recognition.start();
    } catch {
      setStatus('idle');
    }
  }

  function stopListening() {
    if (!listening) {
      return;
    }
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal glass-card section-card cinematic-panel ai-desk-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ai-desk-header">
          <div className="ai-desk-title">
            <Bot size={18} aria-hidden />
            <h2>{t('aiDeskTitle')}</h2>
          </div>
          <button type="button" className="ai-desk-close" onClick={onClose} aria-label={t('close')}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="ai-voice-room">
          <p className="subtle">{t('aiVoiceRoomHint', { names: aiNames })}</p>
          <StatusBanner tone="default">
            <Volume2 size={16} aria-hidden /> {t('aiVoiceRoomOnly')}
          </StatusBanner>
          {!canVoiceOut ? <StatusBanner tone="warning">{t('aiVoiceOutputDisabled')}</StatusBanner> : null}
        </div>

        {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

        <div className="ai-voice-cta">
          <GameButton
            variant={listening ? 'danger' : 'cta'}
            size="lg"
            icon={<Mic size={18} aria-hidden />}
            onClick={() => (listening ? stopListening() : startListening())}
            disabled={!canVoiceIn || status === 'processing'}
          >
            {status === 'processing' ? t('aiThinking') : listening ? t('aiVoiceTapToStop') : t('aiVoiceTapToSpeak')}
          </GameButton>
        </div>
      </div>
    </div>
  );
}
