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

const voiceCache: Partial<Record<Language, SpeechSynthesisVoice>> = {};
const FEMALE_VOICE_HINTS = [
  'female',
  'woman',
  'girl',
  'zira',
  'hazel',
  'susan',
  'sara',
  'salma',
  'leila',
  'layla',
  'amira',
  'mariam',
  'maryam',
  'hana',
  'hoda',
  'noura',
  'noora',
  'fatima',
  'fatma',
];
const MALE_VOICE_HINTS = [
  'male',
  'man',
  'boy',
  'david',
  'mark',
  'alex',
  'maged',
  'majid',
  'tarik',
  'tarek',
  'naayf',
  'fahad',
  'omar',
  'khalid',
  'yousef',
  'yusuf',
];

function hasNameHint(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

function splitForSpeech(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const rough = normalized
    .split(/(?<=[.!؟،,؛:])\s+/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const chunk of rough) {
    if (chunk.length <= 140) {
      chunks.push(chunk);
      continue;
    }
    const words = chunk.split(' ');
    let buffer = '';
    for (const word of words) {
      const next = buffer ? `${buffer} ${word}` : word;
      if (next.length > 140 && buffer) {
        chunks.push(buffer);
        buffer = word;
      } else {
        buffer = next;
      }
    }
    if (buffer) {
      chunks.push(buffer);
    }
  }

  return chunks.length ? chunks : [normalized];
}

function scoreVoice(voice: SpeechSynthesisVoice, language: Language): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const langPrefix = language === 'ar' ? 'ar' : 'en';

  let score = 0;
  if (lang.startsWith(langPrefix)) score += 25;
  if (language === 'ar' && /(ar-sa|ar-eg|ar-ae|ar-jo|ar)\b/.test(lang)) score += 8;
  if (voice.localService) score += 4;

  if (/(natural|neural|premium|enhanced|online)/.test(name)) score += 7;
  if (/(google|microsoft|samsung|apple)/.test(name)) score += 4;
  if (language === 'ar' && /(arabic|arabi|hoda|salma|amira|leila|layla|maryam|mariam)/.test(name)) score += 4;
  if (/(compact|espeak|festival)/.test(name)) score -= 12;
  if (hasNameHint(name, FEMALE_VOICE_HINTS)) score += 22;
  if (hasNameHint(name, MALE_VOICE_HINTS)) score -= 28;

  return score;
}

async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }

  const initial = window.speechSynthesis.getVoices();
  if (initial.length) {
    return initial;
  }

  return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    const onVoicesChanged = () => finish();
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    window.setTimeout(finish, 900);
  });
}

async function pickBestVoice(language: Language): Promise<SpeechSynthesisVoice | undefined> {
  if (voiceCache[language]) {
    return voiceCache[language];
  }

  const voices = await loadVoices();
  if (!voices.length) {
    return undefined;
  }

  const filtered = voices.filter((voice) => {
    const lang = voice.lang.toLowerCase();
    return language === 'ar' ? lang.startsWith('ar') : lang.startsWith('en');
  });
  const pool = filtered.length ? filtered : voices;

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -Infinity;
  for (const voice of pool) {
    const score = scoreVoice(voice, language);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  if (best) {
    voiceCache[language] = best;
  }
  return best;
}

function speakChunk(chunk: string, language: Language, voice?: SpeechSynthesisVoice): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    utterance.voice = voice ?? null;
    utterance.rate = language === 'ar' ? 1.02 : 1;
    utterance.pitch = language === 'ar' ? 1.08 : 1.02;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

async function speakText(text: string, language: Language) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  const segments = splitForSpeech(text);
  if (!segments.length) {
    return;
  }

  try {
    const bestVoice = await pickBestVoice(language);
    window.speechSynthesis.cancel();
    for (const segment of segments) {
      await speakChunk(segment, language, bestVoice);
    }
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
    if (!open || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    void loadVoices();
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
        void speakText(reply, language);
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
