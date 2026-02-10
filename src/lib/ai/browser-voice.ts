import type { Language } from '../../types';

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

export type BrowserVoiceErrorKind = 'unsupported' | 'no-speech' | 'mic' | 'network' | 'unknown';

export class BrowserVoiceError extends Error {
  readonly kind: BrowserVoiceErrorKind;

  constructor(message: string, kind: BrowserVoiceErrorKind) {
    super(message);
    this.name = 'BrowserVoiceError';
    this.kind = kind;
  }
}

export interface BrowserTranscriptResult {
  text: string;
  confidence: number;
}

const ARABIC_EGYPTIAN_LOCALE = 'ar-EG';
const voiceCache: Partial<Record<Language, SpeechSynthesisVoice>> = {};
let speechSessionNonce = 0;

function cleanTranscriptText(text: string): string {
  return text
    .replace(/[\u200f\u200e]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([،,؛:.!?؟]){2,}/g, '$1')
    .trim();
}

function mapSpeechError(kind: string | undefined): BrowserVoiceError {
  switch (kind) {
    case 'no-speech':
      return new BrowserVoiceError('No clear speech detected.', 'no-speech');
    case 'audio-capture':
    case 'not-allowed':
    case 'service-not-allowed':
      return new BrowserVoiceError('Microphone access denied.', 'mic');
    case 'network':
      return new BrowserVoiceError('Speech recognition network error.', 'network');
    default:
      return new BrowserVoiceError('Speech recognition failed.', 'unknown');
  }
}

function hasNameHint(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

const EGYPTIAN_VOICE_HINTS = ['egypt', 'egyptian', 'misr', 'masr', 'ar-eg', 'hoda', 'salma', 'maged', 'naayf', 'tarik'];
const HIGH_QUALITY_HINTS = ['natural', 'neural', 'wavenet', 'studio', 'enhanced', 'premium', 'online'];

function scoreVoice(voice: SpeechSynthesisVoice, language: Language): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const langPrefix = language === 'ar' ? 'ar' : 'en';

  let score = 0;
  if (lang.startsWith(langPrefix)) score += 24;
  if (language === 'ar' && (lang === ARABIC_EGYPTIAN_LOCALE.toLowerCase() || /^ar-eg\b/.test(lang))) score += 60;
  if (!voice.localService) score += 8;
  if (voice.localService) score -= 2;
  if (hasNameHint(name, HIGH_QUALITY_HINTS)) score += 14;
  if (language === 'ar' && hasNameHint(name, EGYPTIAN_VOICE_HINTS)) score += 12;
  if (/(compact|espeak|festival|robot|offline basic)/.test(name)) score -= 18;

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
    window.setTimeout(finish, 800);
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

  const languagePool = voices.filter((voice) => {
    const lang = voice.lang.toLowerCase();
    return language === 'ar' ? lang.startsWith('ar') : lang.startsWith('en');
  });
  const pool = languagePool.length ? languagePool : voices;

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -Infinity;
  for (const voice of pool) {
    const score = scoreVoice(voice, language);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }

  if (best) {
    voiceCache[language] = best;
  }
  return best;
}

function splitForSpeech(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }
  const parts = normalized
    .split(/(?<=[.!؟،,؛:])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [normalized];
}

function humanizeForSpeech(text: string, language: Language): string {
  const normalized = text
    .replace(/[•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.{3,}/g, '.')
    .replace(/([!؟?]){2,}/g, '$1')
    .trim();
  if (!normalized) {
    return '';
  }
  const withAcronyms = language === 'ar' ? normalized.replace(/\bAI\b/gi, 'إيه آي') : normalized;
  return /[.!؟]$/.test(withAcronyms) ? withAcronyms : `${withAcronyms}.`;
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

function awaiter(callback: (resolve: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => callback(resolve));
}

export function cancelBrowserSpeechOutput() {
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

export async function speakWithBrowserSynthesis(text: string, language: Language): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    throw new BrowserVoiceError('Speech synthesis is not supported.', 'unsupported');
  }

  const segments = splitForSpeech(humanizeForSpeech(text, language));
  if (!segments.length) {
    return;
  }

  const session = ++speechSessionNonce;
  const bestVoice = await pickBestVoice(language);
  window.speechSynthesis.cancel();

  for (const segment of segments) {
    if (session !== speechSessionNonce) {
      return;
    }
    await speakChunk(segment, language, bestVoice);
    if (session !== speechSessionNonce) {
      return;
    }
    await awaiter((resolve) => window.setTimeout(resolve, 60));
  }
}

export async function transcribeWithBrowserRecognition(
  language: Language,
  timeoutMs = 8_000,
): Promise<BrowserTranscriptResult> {
  if (typeof window === 'undefined') {
    throw new BrowserVoiceError('Speech recognition is not supported.', 'unsupported');
  }

  const voiceWindow = window as unknown as SpeechRecognitionWindow;
  const SpeechRecognitionCtor = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    throw new BrowserVoiceError('Speech recognition is not supported.', 'unsupported');
  }

  return await new Promise<BrowserTranscriptResult>((resolve, reject) => {
    const recognition = new SpeechRecognitionCtor();
    let settled = false;
    let pickedText = '';
    let pickedConfidence = 0.65;
    const finalize = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      fn();
    };

    const timeout = window.setTimeout(() => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      finalize(() => reject(new BrowserVoiceError('Speech recognition timed out.', 'no-speech')));
    }, timeoutMs);

    recognition.lang = language === 'ar' ? ARABIC_EGYPTIAN_LOCALE : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 2;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const startIndex = event.resultIndex ?? 0;
      const results = event.results ?? [];

      for (let i = startIndex; i < results.length; i += 1) {
        const result = results[i];
        const isFinal = Boolean(result?.isFinal);
        const alt = result?.[0];
        const transcript = cleanTranscriptText(alt?.transcript?.toString() ?? '');
        if (!transcript) continue;

        pickedText = transcript;
        const confidence = typeof alt?.confidence === 'number' ? alt.confidence : isFinal ? 0.76 : 0.58;
        pickedConfidence = Math.max(0, Math.min(1, confidence));
      }
    };

    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      finalize(() => reject(mapSpeechError(event.error)));
    };

    recognition.onend = () => {
      if (!pickedText) {
        finalize(() => reject(new BrowserVoiceError('No clear speech detected.', 'no-speech')));
        return;
      }
      finalize(() =>
        resolve({
          text: pickedText,
          confidence: pickedConfidence,
        }),
      );
    };

    try {
      recognition.start();
    } catch {
      finalize(() => reject(new BrowserVoiceError('Failed to start speech recognition.', 'unknown')));
    }
  });
}
