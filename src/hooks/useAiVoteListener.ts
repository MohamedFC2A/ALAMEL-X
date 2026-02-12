import { useCallback, useEffect, useRef, useState } from 'react';

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
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export interface VoteListenerTranscript {
  text: string;
  at: number;
}

export interface UseAiVoteListenerResult {
  isListening: boolean;
  transcripts: VoteListenerTranscript[];
  error: string;
  startListening: () => void;
  stopListening: () => void;
}

interface UseAiVoteListenerParams {
  enabled: boolean;
  discussionActive: boolean;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechRecognitionWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useAiVoteListener({
  enabled,
  discussionActive,
}: UseAiVoteListenerParams): UseAiVoteListenerResult {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<VoteListenerTranscript[]>([]);
  const [error, setError] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldBeActiveRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    shouldBeActiveRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('aiVoteMicNotSupported');
      return;
    }

    cleanup();
    shouldBeActiveRef.current = true;
    setError('');

    const recognition = new Ctor();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const startIdx = event.resultIndex ?? 0;
      const results = event.results ?? [];
      for (let i = startIdx; i < results.length; i += 1) {
        const result = results[i];
        if (!result?.isFinal) continue;
        const alt = result[0];
        const text = alt?.transcript
          ?.replace(/[\u200f\u200e]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) {
          setTranscripts((prev) => [...prev, { text, at: Date.now() }]);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      const kind = event.error;
      if (kind === 'no-speech' || kind === 'aborted') {
        return;
      }
      if (kind === 'not-allowed' || kind === 'audio-capture' || kind === 'service-not-allowed') {
        setError('aiVoteMicError');
        shouldBeActiveRef.current = false;
        setIsListening(false);
        return;
      }
      if (kind === 'network') {
        setError('aiVoteMicError');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (shouldBeActiveRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (shouldBeActiveRef.current) {
            try {
              recognition.start();
              setIsListening(true);
            } catch {
              shouldBeActiveRef.current = false;
            }
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError('aiVoteMicError');
      shouldBeActiveRef.current = false;
    }
  }, [cleanup]);

  const stopListening = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (enabled && discussionActive) {
      startListening();
    } else {
      cleanup();
    }
    return cleanup;
  }, [enabled, discussionActive, startListening, cleanup]);

  useEffect(() => {
    if (!enabled) {
      setTranscripts([]);
      setError('');
    }
  }, [enabled]);

  return { isListening, transcripts, error, startListening, stopListening };
}
