import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Mic, Send, X } from 'lucide-react';
import type { ActiveMatch, AiThreadState, GlobalSettings, Language, Player } from '../types';
import { db } from '../lib/db';
import { updateActiveMatch } from '../lib/game-repository';
import { DeepSeekError } from '../lib/ai/deepseek-client';
import { generateChatReply, generateQuestion, runtimeConfigFromSettings } from '../lib/ai/agent';
import { StatusBanner } from './StatusBanner';
import { GameButton } from './GameButton';

type SpeechRecognitionEventLike = {
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

function speakText(text: string, language: Language) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'ar' ? 'ar' : 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore
  }
}

export function AiDeskModal({ open, onClose, activeMatch, aiPlayers, playerMap, settings, language }: AiDeskModalProps) {
  const { t } = useTranslation();
  const [selectedAiId, setSelectedAiId] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'asking'>('idle');
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const selectedAi = useMemo(() => aiPlayers.find((player) => player.id === selectedAiId) ?? aiPlayers[0] ?? null, [aiPlayers, selectedAiId]);
  const thread = useMemo(() => {
    if (!selectedAi) return buildEmptyThread();
    return activeMatch.ai?.threads?.[selectedAi.id] ?? buildEmptyThread();
  }, [activeMatch.ai, selectedAi]);

  useEffect(() => {
    if (!open) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setListening(false);
      return;
    }

    if (!selectedAiId && aiPlayers.length > 0) {
      setSelectedAiId(aiPlayers[0].id);
    }
  }, [aiPlayers, open, selectedAiId]);

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

  function startListening() {
    if (!canVoiceIn) {
      return;
    }
    if (listening) {
      return;
    }

    const windowWithSpeech = window as unknown as SpeechRecognitionWindow;
    const SpeechRecognitionCtor = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError(t('aiVoiceUnsupported'));
      return;
    }

    setError('');
    setListening(true);

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = language === 'ar' ? 'ar' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
      const next = transcript.toString().trim();
      if (next) {
        setDraft((prev) => (prev ? `${prev} ${next}` : next));
      }
    };

    recognition.onerror = () => {
      setError(t('aiVoiceError'));
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
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

  async function sendText(text: string) {
    if (!selectedAi) {
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
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

    setError('');
    setStatus('sending');
    setDraft('');

    try {
      const config = runtimeConfigFromSettings(settings);
      const context = buildContext(activeMatch, selectedAi, language, playerMap);
      const baseThread = activeMatch.ai?.threads?.[selectedAi.id] ?? buildEmptyThread();

      await appendMessages(selectedAi.id, [{ from: 'user', text: trimmed }]);

      const { reply } = await generateChatReply(config, context, baseThread, trimmed);

      await appendMessages(selectedAi.id, [{ from: 'ai', text: reply }]);

      if (canVoiceOut) {
        speakText(reply, language);
      }
    } catch (err) {
      setError(formatAiError(err, t));
    } finally {
      setStatus('idle');
    }
  }

  async function askQuestion() {
    if (!selectedAi) {
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

    setError('');
    setStatus('asking');

    try {
      const config = runtimeConfigFromSettings(settings);
      const context = buildContext(activeMatch, selectedAi, language, playerMap);
      const baseThread = activeMatch.ai?.threads?.[selectedAi.id] ?? buildEmptyThread();
      const question = await generateQuestion(config, context, baseThread);
      if (question) {
        await appendMessages(selectedAi.id, [{ from: 'ai', text: question }]);
        if (canVoiceOut) {
          speakText(question, language);
        }
      }
    } catch (err) {
      setError(formatAiError(err, t));
    } finally {
      setStatus('idle');
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

        <label className="form-field">
          <span>{t('aiChooseAgent')}</span>
          <select value={selectedAi?.id ?? ''} onChange={(event) => setSelectedAiId(event.target.value)}>
            {aiPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ai-chat-log" role="log" aria-live="polite">
          {(thread.messages ?? []).length === 0 ? (
            <p className="subtle ai-chat-empty">{t('aiDeskEmpty')}</p>
          ) : (
            (thread.messages ?? []).map((msg) => (
              <div key={`${msg.at}-${msg.from}`} className={`ai-chat-bubble ${msg.from === 'user' ? 'from-user' : 'from-ai'}`.trim()}>
                <span>{msg.text}</span>
              </div>
            ))
          )}
        </div>

        {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

        <div className="ai-chat-controls">
          <GameButton
            variant={listening ? 'danger' : 'ghost'}
            size="md"
            icon={<Mic size={18} aria-hidden />}
            onPointerDown={(event) => {
              event.preventDefault();
              startListening();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              stopListening();
            }}
            onPointerLeave={() => stopListening()}
            onPointerCancel={() => stopListening()}
            disabled={!canVoiceIn}
          >
            {listening ? t('aiListening') : t('aiSpeak')}
          </GameButton>

          <input
            className="ai-chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('aiTypeHere')}
            maxLength={240}
          />

          <GameButton
            variant="cta"
            size="md"
            icon={<Send size={18} aria-hidden />}
            onClick={() => void sendText(draft)}
            disabled={status !== 'idle' || !draft.trim()}
          >
            {t('aiSend')}
          </GameButton>
        </div>

        <div className="actions-row ai-desk-actions">
          <GameButton variant="ghost" size="md" onClick={() => void askQuestion()} disabled={status !== 'idle'}>
            {t('aiAskQuestion')}
          </GameButton>
        </div>
      </div>
    </div>
  );
}
