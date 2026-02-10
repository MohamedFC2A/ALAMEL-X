import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Mic, Volume2, X } from 'lucide-react';
import type { ActiveMatch, AiThreadState, GlobalSettings, Language, Player } from '../types';
import { db } from '../lib/db';
import { updateActiveMatch } from '../lib/game-repository';
import { chatComplete, DeepSeekError } from '../lib/ai/deepseek-client';
import { generateChatReply, runtimeConfigFromSettings, type AiRuntimeConfig } from '../lib/ai/agent';
import { StatusBanner } from './StatusBanner';
import { GameButton } from './GameButton';

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
  confidence?: number;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike> & {
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results?: ArrayLike<SpeechRecognitionResultLike>;
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionEventLike) => void) | null;
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

interface TranscriptHypothesis {
  text: string;
  confidence: number;
  isFinal: boolean;
}

interface TranscriptSelection {
  text: string;
  confidence: number;
}

function buildEmptyThread(): AiThreadState {
  return { messages: [], summary: '' };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEADING_WAKE_FILLERS_PATTERN =
  /^(?:يا\s+)?(?:لو\s+سمحت(?:ي)?\s+|بعد\s+اذنك\s+|اسمع(?:ني)?\s+|بص(?:ي)?\s+|طيب\s+|ممكن\s+|please\s+|hey\s+|hi\s+)+/i;

const SPEECH_CORRECTIONS: Array<[RegExp, string]> = [
  [/\b(إي|اي|اى)\s*[- ]?\s*(آي|اي|اى)\b/giu, 'AI'],
  [/\b(إكس|اكس)\b/giu, 'X'],
];

function cleanTranscriptText(text: string): string {
  let cleaned = text
    .replace(/[\u200f\u200e]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([،,؛:.!?؟]){2,}/g, '$1')
    .trim();

  for (const [pattern, replacement] of SPEECH_CORRECTIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  let guard = 0;
  while (guard < 3) {
    const next = cleaned.replace(LEADING_WAKE_FILLERS_PATTERN, '').trim();
    if (next === cleaned) {
      break;
    }
    cleaned = next;
    guard += 1;
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

function buildThreadSummary(messages: Array<{ from: 'user' | 'ai'; text: string; at?: number }>): string {
  const recent = messages.slice(-8);
  if (!recent.length) {
    return '';
  }

  const compact = recent
    .map((msg) => {
      const speaker = msg.from === 'user' ? 'المستخدم' : 'العميل';
      const text = msg.text.replace(/\s+/g, ' ').trim();
      return `${speaker}: ${text}`;
    })
    .join(' | ');

  return compact.length > 520 ? `${compact.slice(0, 520)}…` : compact;
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
  return cleanTranscriptText(text)
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[\u064b-\u065f\u0610-\u061a\u06d6-\u06ed]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWakePhrase(text: string, aiName: string): string {
  const escaped = escapeRegExp(aiName.trim());
  let stripped = text.replace(new RegExp(`^\\s*(?:يا\\s*)?${escaped}[،,:\\-\\s]*`, 'i'), '').trim();
  stripped = stripped.replace(/^\s*(?:يا\s*)?(?:ال)?عميل(?:\s+[xX])?[،,:\-\s]*/i, '').trim();
  return cleanTranscriptText(stripped).trim();
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

function scoreTranscriptHypothesis(candidate: TranscriptHypothesis, aiPlayers: Player[]): number {
  const normalized = normalizeSpeechText(candidate.text);
  const hasArabic = /[\u0600-\u06FF]/.test(candidate.text);
  const mentionsAgent = aiPlayers.some((player) => normalized.includes(normalizeSpeechText(player.name)));
  const maybeWakeWord = /^(?:يا|agent|العميل|عميل)\b/i.test(candidate.text.trim());
  const wordCount = normalized.split(' ').filter(Boolean).length;

  let score = candidate.confidence * 100;
  if (candidate.isFinal) score += 24;
  if (hasArabic) score += 6;
  if (mentionsAgent) score += 18;
  if (maybeWakeWord) score += 10;
  if (candidate.text.length >= 6) score += 8;
  if (candidate.text.length > 220) score -= 20;
  if (wordCount <= 1) score -= 22;

  return score;
}

function pickBestTranscript(hypotheses: TranscriptHypothesis[], aiPlayers: Player[]): TranscriptSelection {
  const usable = hypotheses
    .map((item) => ({
      text: cleanTranscriptText(item.text),
      confidence: Math.max(0, Math.min(1, item.confidence)),
      isFinal: item.isFinal,
    }))
    .filter((item) => item.text.length >= 2);

  if (!usable.length) {
    return { text: '', confidence: 0 };
  }

  let winner = usable[0];
  let winnerScore = scoreTranscriptHypothesis(winner, aiPlayers);
  for (const candidate of usable.slice(1)) {
    const score = scoreTranscriptHypothesis(candidate, aiPlayers);
    if (score > winnerScore) {
      winner = candidate;
      winnerScore = score;
    }
  }

  return { text: winner.text, confidence: winner.confidence };
}

function shouldRunTranscriptRefine(text: string, confidence: number): boolean {
  const words = text.split(/\s+/).filter(Boolean).length;
  const hasGarbage = /[^\p{L}\p{N}\s،,.!?:؛؟-]/u.test(text);
  return confidence < 0.84 || words <= 1 || hasGarbage;
}

function sanitizeRefinedTranscript(refined: string, fallback: string): string {
  const compact = cleanTranscriptText(
    refined
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(?:النص المصحح|corrected text|transcript)\s*[:：-]\s*/i, '')
      .trim(),
  );

  if (!compact) {
    return fallback;
  }

  if (compact.length > Math.max(260, fallback.length * 2)) {
    return fallback;
  }

  return compact;
}

async function refineTranscriptWithAi(
  config: AiRuntimeConfig,
  language: Language,
  rawText: string,
  agentName: string,
): Promise<string> {
  const localeGuide =
    language === 'ar'
      ? 'عامية مصرية مفهومة. صحّح الأخطاء السمعية فقط بدون تغيير القصد.'
      : 'Clear spoken English. Correct speech-to-text mistakes only without changing intent.';

  const response = await chatComplete({
    ...config,
    temperature: 0.1,
    maxTokens: 120,
    messages: [
      {
        role: 'system',
        content:
          'You correct voice transcripts. Return only the corrected user utterance as plain text with no explanations.',
      },
      {
        role: 'user',
        content: `Agent name: ${agentName}\nLanguage style: ${localeGuide}\nTranscript: ${rawText}`,
      },
    ],
  });

  return sanitizeRefinedTranscript(response, rawText);
}

function mapSpeechRecognitionError(errorCode: string | undefined, t: (key: string) => string): string {
  switch (errorCode) {
    case 'no-speech':
      return t('aiVoiceNoSpeech');
    case 'audio-capture':
    case 'not-allowed':
    case 'service-not-allowed':
      return t('aiVoiceMicAccessError');
    case 'network':
      return t('aiNetworkError');
    default:
      return t('aiVoiceError');
  }
}

async function primeMicrophoneCapture(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

const voiceCache: Partial<Record<Language, SpeechSynthesisVoice>> = {};
let speechSessionNonce = 0;
const ARABIC_EGYPTIAN_LOCALE = 'ar-EG';
const EGYPTIAN_VOICE_HINTS = [
  'egypt',
  'egyptian',
  'misr',
  'masr',
  'ar-eg',
  'hoda',
  'salma',
  'maged',
  'naayf',
  'tarik',
  'tarek',
  'amira',
];
const HIGH_QUALITY_HINTS = ['natural', 'neural', 'wavenet', 'studio', 'enhanced', 'premium', 'online'];

function hasNameHint(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

function isEgyptianVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  return lang === ARABIC_EGYPTIAN_LOCALE.toLowerCase() || /^ar-eg\b/.test(lang) || hasNameHint(name, EGYPTIAN_VOICE_HINTS);
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

function humanizeForSpeech(text: string, language: Language): string {
  const normalized = text
    .replace(/[•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.{3,}/g, '.')
    .replace(/([!؟?]){2,}/g, '$1')
    .replace(/([،,؛:]){2,}/g, '$1')
    .trim();

  if (!normalized) {
    return normalized;
  }

  const withReadableAcronyms = language === 'ar' ? normalized.replace(/\bAI\b/gi, 'إيه آي') : normalized;
  return /[.!؟]$/.test(withReadableAcronyms) ? withReadableAcronyms : `${withReadableAcronyms}.`;
}

function scoreVoice(voice: SpeechSynthesisVoice, language: Language): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const langPrefix = language === 'ar' ? 'ar' : 'en';

  let score = 0;
  if (lang.startsWith(langPrefix)) score += 25;
  if (language === 'ar' && lang === ARABIC_EGYPTIAN_LOCALE.toLowerCase()) score += 64;
  if (language === 'ar' && /^ar-eg\b/.test(lang)) score += 50;
  if (language === 'ar' && /(ar-sa|ar-ae|ar-jo|ar)\b/.test(lang)) score += 4;
  if (voice.localService) score -= 1;
  if (!voice.localService) score += 7;

  if (hasNameHint(name, HIGH_QUALITY_HINTS)) score += 16;
  if (/(google|microsoft|samsung|apple)/.test(name)) score += 4;
  if (language === 'ar' && hasNameHint(name, EGYPTIAN_VOICE_HINTS)) score += 12;
  if (/(compact|espeak|festival|robot|siri compact|offline basic)/.test(name)) score -= 18;

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
  const preferredEgyptianPool = language === 'ar' ? pool.filter((voice) => isEgyptianVoice(voice)) : pool;
  const scoringPool = preferredEgyptianPool.length ? preferredEgyptianPool : pool;

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -Infinity;
  for (const voice of scoringPool) {
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
    utterance.lang = language === 'ar' ? ARABIC_EGYPTIAN_LOCALE : 'en-US';
    utterance.voice = voice ?? null;
    utterance.rate = language === 'ar' ? 0.9 : 0.98;
    utterance.pitch = language === 'ar' ? 1 : 1.02;
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

  const segments = splitForSpeech(humanizeForSpeech(text, language));
  if (!segments.length) {
    return;
  }

  try {
    const sessionNonce = ++speechSessionNonce;
    const bestVoice = await pickBestVoice(language);
    window.speechSynthesis.cancel();
    for (const segment of segments) {
      if (sessionNonce !== speechSessionNonce) {
        return;
      }
      await speakChunk(segment, language, bestVoice);
      if (sessionNonce !== speechSessionNonce) {
        return;
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 70);
      });
    }
  } catch {
    // ignore
  }
}

function cancelSpeechOutput() {
  speechSessionNonce += 1;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export function AiDeskModal({ open, onClose, activeMatch, aiPlayers, playerMap, settings, language }: AiDeskModalProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [error, setError] = useState('');
  const [activeAgentName, setActiveAgentName] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listening = status === 'listening';
  const speaking = status === 'speaking';
  const voiceWaveActive = listening || speaking;
  const voiceWaveProcessing = status === 'processing';

  const aiNames = useMemo(() => aiPlayers.map((player) => player.name).join('، '), [aiPlayers]);
  const displayedAgentName = useMemo(() => {
    if (activeAgentName && aiPlayers.some((player) => player.name === activeAgentName)) {
      return activeAgentName;
    }
    return aiPlayers[0]?.name ?? '';
  }, [activeAgentName, aiPlayers]);

  useEffect(() => {
    if (!open) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      cancelSpeechOutput();
      recognitionRef.current = null;
      window.setTimeout(() => {
        setStatus('idle');
      }, 0);
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

  const canUseAi = Boolean(settings?.aiEnabled);
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
    const mergedMessages = [...(baseThread.messages ?? []), ...appended];
    const nextThread: AiThreadState = {
      ...baseThread,
      messages: mergedMessages,
      summary: buildThreadSummary(mergedMessages),
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

  async function handleVoiceCommand(utterance: string, recognitionConfidence = 0.75) {
    const targetAi = resolveAiTarget(utterance, aiPlayers);
    if (!targetAi) {
      return;
    }
    setActiveAgentName(targetAi.name);

    if (!settings?.aiEnabled) {
      setError(t('aiDisabled'));
      return;
    }

    if (!canUseAi) {
      setError(t('aiSetupRequired'));
      return;
    }

    const config = runtimeConfigFromSettings(settings);
    let cleanedText = stripWakePhrase(utterance, targetAi.name);
    if (!cleanedText) {
      setError(t('aiVoiceNeedPrompt'));
      return;
    }

    setError('');
    setStatus('processing');

    if (shouldRunTranscriptRefine(cleanedText, recognitionConfidence)) {
      try {
        cleanedText = await refineTranscriptWithAi(config, language, cleanedText, targetAi.name);
      } catch {
        // ignore transcript refine failures to keep the voice loop fast.
      }
    }

    try {
      const context = buildContext(activeMatch, targetAi, language, playerMap);
      const baseThread = activeMatch.ai?.threads?.[targetAi.id] ?? buildEmptyThread();

      await appendMessages(targetAi.id, [{ from: 'user', text: cleanedText }]);
      const { reply } = await generateChatReply(config, context, baseThread, cleanedText);
      await appendMessages(targetAi.id, [{ from: 'ai', text: reply }]);

      if (canVoiceOut) {
        setStatus('speaking');
        await speakText(reply, language);
      }
      setStatus('idle');
    } catch (err) {
      setError(formatAiError(err, t));
      setStatus('idle');
    }
  }

  async function startListening() {
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
    setStatus('processing');

    const micReady = await primeMicrophoneCapture();
    if (!micReady) {
      setStatus('idle');
      setError(t('aiVoiceMicAccessError'));
      return;
    }

    setStatus('listening');

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = language === 'ar' ? ARABIC_EGYPTIAN_LOCALE : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;
    const hypotheses: TranscriptHypothesis[] = [];
    const finalSegments: string[] = [];
    let finalConfidenceSum = 0;
    let finalCount = 0;
    let latestInterim = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const startIndex = event.resultIndex ?? 0;
      const results = event.results ?? [];
      for (let i = startIndex; i < results.length; i += 1) {
        const result = results[i];
        const isFinal = Boolean(result?.isFinal);
        const alternatives = Math.min(result?.length ?? 0, 3);

        for (let altIndex = 0; altIndex < alternatives; altIndex += 1) {
          const alternative = result?.[altIndex];
          const transcript = cleanTranscriptText(alternative?.transcript?.toString().trim() ?? '');
          if (!transcript) {
            continue;
          }
          const rawConfidence = alternative?.confidence;
          const fallbackConfidence = isFinal ? 0.78 - altIndex * 0.08 : 0.56 - altIndex * 0.06;
          const confidence =
            typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
              ? Math.max(0, Math.min(1, rawConfidence))
              : Math.max(0.1, fallbackConfidence);

          hypotheses.push({ text: transcript, confidence, isFinal });
        }

        const primary = cleanTranscriptText(result?.[0]?.transcript?.toString().trim() ?? '');
        if (!primary) {
          continue;
        }

        if (isFinal) {
          finalSegments.push(primary);
          const primaryConfidence = result?.[0]?.confidence;
          finalConfidenceSum +=
            typeof primaryConfidence === 'number' && Number.isFinite(primaryConfidence)
              ? Math.max(0, Math.min(1, primaryConfidence))
              : 0.78;
          finalCount += 1;
        } else {
          latestInterim = primary;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      setError(mapSpeechRecognitionError(event.error, t));
      setStatus('idle');
    };

    recognition.onend = () => {
      setStatus('idle');

      const joinedFinal = cleanTranscriptText(finalSegments.join(' '));
      if (joinedFinal) {
        const averagedConfidence = finalCount ? finalConfidenceSum / finalCount : 0.78;
        hypotheses.push({ text: joinedFinal, confidence: averagedConfidence, isFinal: true });
      }
      if (latestInterim) {
        hypotheses.push({ text: latestInterim, confidence: 0.58, isFinal: false });
      }

      const picked = pickBestTranscript(hypotheses, aiPlayers);
      if (picked.text.trim()) {
        void handleVoiceCommand(picked.text.trim(), picked.confidence);
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

  function stopSpeaking() {
    if (!speaking) {
      return;
    }
    cancelSpeechOutput();
    setStatus('idle');
  }

  function closeModal() {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    cancelSpeechOutput();
    setStatus('idle');
    onClose();
  }

  const currentVoiceStateLabel =
    status === 'listening'
      ? t('aiVoiceStateListening')
      : status === 'processing'
        ? t('aiVoiceStateProcessing')
        : status === 'speaking'
          ? t('aiVoiceStateSpeaking')
          : t('aiVoiceStateIdle');

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeModal}>
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
          <button type="button" className="ai-desk-close" onClick={closeModal} aria-label={t('close')}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="ai-voice-room">
          <p className="subtle">{t('aiVoiceRoomHint', { names: aiNames })}</p>
          <div className="ai-voice-agent-card">
            <div className="ai-voice-agent-meta">
              <span className="ai-voice-agent-label">{t('aiVoiceAgentLabel')}</span>
              <strong className="ai-voice-agent-name">{displayedAgentName}</strong>
            </div>
            <div
              className={`ai-voice-wave ${voiceWaveActive ? 'is-active' : ''} ${voiceWaveProcessing ? 'is-processing' : ''}`.trim()}
              aria-hidden="true"
            >
              <span className="ai-voice-wave-bar" />
              <span className="ai-voice-wave-bar" />
              <span className="ai-voice-wave-bar" />
              <span className="ai-voice-wave-bar" />
              <span className="ai-voice-wave-bar" />
            </div>
            <p className="subtle ai-voice-state">{currentVoiceStateLabel}</p>
          </div>
          <StatusBanner tone="default">
            <Volume2 size={16} aria-hidden /> {t('aiVoiceRoomOnly')}
          </StatusBanner>
          {!canVoiceOut ? <StatusBanner tone="warning">{t('aiVoiceOutputDisabled')}</StatusBanner> : null}
        </div>

        {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

        <div className="ai-voice-cta">
          <GameButton
            variant={listening || speaking ? 'danger' : 'cta'}
            size="lg"
            icon={<Mic size={18} aria-hidden />}
            onClick={() => {
              if (listening) {
                stopListening();
                return;
              }
      if (speaking) {
        stopSpeaking();
        return;
      }
      void startListening();
    }}
            disabled={!canVoiceIn || status === 'processing'}
          >
            {status === 'processing'
              ? t('aiThinking')
              : listening
                ? t('aiVoiceTapToStop')
                : speaking
                  ? t('aiVoiceStopPlayback')
                  : t('aiVoiceTapToSpeak')}
          </GameButton>
        </div>
      </div>
    </div>
  );
}
