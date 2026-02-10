import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveMatch, AiOrchestratorState, AiThreadState, GlobalSettings, Language, Player } from '../types';
import { db } from '../lib/db';
import { nowMs } from '../lib/clock';
import { updateActiveMatch } from '../lib/game-repository';
import { DeepSeekError } from '../lib/ai/deepseek-client';
import {
  asNamedLine,
  DEFAULT_POST_QUESTION_ANSWER_WINDOW_MS,
  DEFAULT_SILENCE_THRESHOLD_MS,
  isYesNoQuestion,
  pickNextTargetPlayerId,
  scoreSuspicionFromTranscript,
  shouldTriggerSilenceIntervention,
} from '../lib/ai/discussion-orchestrator';
import { runtimeConfigFromSettings, generateChatReply, generateDirectedQuestion, generateSuspicionInterjection, decideYesNo } from '../lib/ai/agent';
import { ElevenError, transcribeWithEleven, speakWithEleven, cancelElevenSpeechOutput } from '../lib/ai/eleven-client';
import { BrowserVoiceError, cancelBrowserSpeechOutput, speakWithBrowserSynthesis, transcribeWithBrowserRecognition } from '../lib/ai/browser-voice';

interface UseAiDiscussionOrchestratorParams {
  activeMatch: ActiveMatch | null;
  aiPlayers: Player[];
  playerMap: Map<string, Player>;
  settings: GlobalSettings | undefined;
  language: Language;
}

export interface UseAiDiscussionOrchestratorResult {
  state: AiOrchestratorState;
  error: string;
  runtimeEnabled: boolean;
  toggleRuntimeEnabled: () => void;
  clearError: () => void;
}

interface TranscriptResult {
  text: string;
  confidence: number;
  provider: 'elevenlabs' | 'browser';
}

const VAD_MIN_RMS = 0.024;
const VAD_MIN_VOICE_HOLD_MS = 150;
const VAD_SILENCE_END_MS = 620;
const MIN_BLOB_BYTES = 900;

function buildEmptyThread(): AiThreadState {
  return { messages: [], summary: '' };
}

function buildThreadSummary(messages: Array<{ from: 'user' | 'ai'; text: string }>): string {
  const recent = messages.slice(-10);
  if (!recent.length) {
    return '';
  }
  const compact = recent
    .map((message) => `${message.from === 'user' ? 'المستخدم' : 'العميل'}: ${message.text.replace(/\s+/g, ' ').trim()}`)
    .join(' | ');
  return compact.length > 560 ? `${compact.slice(0, 560)}…` : compact;
}

function buildContext(activeMatch: ActiveMatch, aiPlayer: Player, language: Language, playerMap: Map<string, Player>) {
  const isSpy = activeMatch.match.spyIds.includes(aiPlayer.id);
  const role = isSpy ? 'spy' : 'citizen';
  const secretWord = role === 'citizen' ? (language === 'ar' ? activeMatch.wordTextAr : activeMatch.wordTextEn) : undefined;
  const spyHintText = role === 'spy' ? (language === 'ar' ? activeMatch.spyHintAr : activeMatch.spyHintEn) : undefined;
  const spyTeammateNames =
    role === 'spy'
      ? activeMatch.match.spyIds.filter((id) => id !== aiPlayer.id).map((id) => playerMap.get(id)?.name ?? id)
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

function activeAiFrom(aiPlayers: Player[]): Player | null {
  return aiPlayers.length ? aiPlayers[0] : null;
}

function detectMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  return '';
}

function stateAfterSpeech(hasPendingTarget: boolean): AiOrchestratorState['status'] {
  return hasPendingTarget ? 'waiting_answer' : 'listening';
}

function pickVoiceErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof DeepSeekError) {
    if (error.kind === 'auth') return t('aiAuthError');
    if (error.kind === 'rate_limit') return t('aiRateLimitError');
    if (error.kind === 'network') return t('aiNetworkError');
    return t('aiUnknownError');
  }
  if (error instanceof ElevenError) {
    if (error.kind === 'auth') return t('aiAuthError');
    if (error.kind === 'rate_limit') return t('aiRateLimitError');
    if (error.kind === 'network') return t('aiNetworkError');
    return t('aiUnknownError');
  }
  if (error instanceof BrowserVoiceError) {
    if (error.kind === 'no-speech') return t('aiVoiceNoSpeech');
    if (error.kind === 'mic') return t('aiVoiceMicAccessError');
    if (error.kind === 'network') return t('aiNetworkError');
    if (error.kind === 'unsupported') return t('aiVoiceUnsupported');
    return t('aiVoiceError');
  }
  return t('aiVoiceError');
}

function defaultState(runtimeEnabled: boolean, activeAi: Player | null): AiOrchestratorState {
  return {
    status: 'idle',
    activeAiId: activeAi?.id ?? '',
    activeAiName: activeAi?.name ?? '',
    pendingTargetPlayerId: '',
    pendingTargetName: '',
    lastSpeakerName: '',
    lastTranscript: '',
    lastIntervention: '',
    silenceMs: 0,
    isListening: false,
    isSpeaking: false,
    runtimeEnabled,
    updatedAt: Date.now(),
  };
}

export function useAiDiscussionOrchestrator({
  activeMatch,
  aiPlayers,
  playerMap,
  settings,
  language,
}: UseAiDiscussionOrchestratorParams): UseAiDiscussionOrchestratorResult {
  const { t } = useTranslation();
  const primaryAi = useMemo(() => activeAiFrom(aiPlayers), [aiPlayers]);
  const activeMatchId = activeMatch?.match.id ?? '';
  const [runtimeEnabled, setRuntimeEnabled] = useState<boolean>(settings?.aiAutoFacilitatorEnabled ?? true);
  const [state, setState] = useState<AiOrchestratorState>(() => defaultState(runtimeEnabled, primaryAi));
  const [error, setError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechBufferRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);

  const recordingRef = useRef(false);
  const speechHoldStartRef = useRef(0);
  const pendingTargetRef = useRef<string | null>(null);
  const pendingDeadlineRef = useRef(0);
  const lastVoiceActivityRef = useRef(nowMs());
  const lastInterventionAtRef = useRef(0);
  const targetCursorRef = useRef(0);
  const processingRef = useRef(false);
  const interventionLockRef = useRef(false);
  const queueRef = useRef<Blob[]>([]);
  const speakingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const suspicionScoreRef = useRef<Record<string, number>>({});

  const settingsRef = useRef(settings);
  const languageRef = useRef(language);
  const playerMapRef = useRef(playerMap);
  const activeMatchRef = useRef(activeMatch);
  const aiPlayersRef = useRef(aiPlayers);
  const runtimeEnabledRef = useRef(runtimeEnabled);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    playerMapRef.current = playerMap;
  }, [playerMap]);

  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  useEffect(() => {
    aiPlayersRef.current = aiPlayers;
  }, [aiPlayers]);

  useEffect(() => {
    runtimeEnabledRef.current = runtimeEnabled;
  }, [runtimeEnabled]);

  useEffect(() => {
    if (!activeMatchId) {
      return;
    }
    setRuntimeEnabled(settings?.aiAutoFacilitatorEnabled ?? true);
  }, [activeMatchId, settings?.aiAutoFacilitatorEnabled]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      activeAiId: primaryAi?.id ?? '',
      activeAiName: primaryAi?.name ?? '',
      runtimeEnabled,
      updatedAt: Date.now(),
    }));
  }, [primaryAi, runtimeEnabled]);

  const clearError = useCallback(() => setError(''), []);
  const toggleRuntimeEnabled = useCallback(() => {
    setRuntimeEnabled((current) => !current);
  }, []);

  const updateState = useCallback((patch: Partial<AiOrchestratorState>) => {
    setState((prev) => ({
      ...prev,
      ...patch,
      updatedAt: Date.now(),
    }));
  }, []);

  const appendMessages = useCallback(async (aiId: string, entries: Array<{ from: 'user' | 'ai'; text: string }>) => {
    if (!entries.length) {
      return;
    }

    const current = await db.activeMatch.get('active');
    if (!current) {
      return;
    }

    const aiIds = current.ai?.playerIds?.length ? current.ai.playerIds : aiPlayersRef.current.map((player) => player.id);
    const existingThreads = current.ai?.threads ?? {};
    const baseThread = existingThreads[aiId] ?? buildEmptyThread();
    const appended = entries.map((entry) => ({ ...entry, at: Date.now() }));
    const mergedMessages = [...(baseThread.messages ?? []), ...appended];
    const nextThread: AiThreadState = {
      ...baseThread,
      messages: mergedMessages,
      summary: buildThreadSummary(mergedMessages),
    };

    await updateActiveMatch({
      ai: {
        playerIds: aiIds,
        threads: {
          ...existingThreads,
          [aiId]: nextThread,
        },
      },
    });
  }, []);

  const updateSuspicionForSpeaker = useCallback((speakerId: string, transcript: string) => {
    if (!speakerId) {
      return;
    }
    const current = suspicionScoreRef.current[speakerId] ?? 0;
    const delta = scoreSuspicionFromTranscript(transcript);
    suspicionScoreRef.current = {
      ...suspicionScoreRef.current,
      [speakerId]: Math.max(0, Math.min(6, current + delta)),
    };
  }, []);

  const speakWithFallback = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        return;
      }
      const currentSettings = settingsRef.current;
      if (!currentSettings?.soundEnabled || !currentSettings.aiVoiceOutputEnabled) {
        return;
      }

      speakingRef.current = true;
      updateState({ status: 'speaking', isSpeaking: true });

      try {
        const preferEleven = (currentSettings.aiVoiceProvider ?? 'elevenlabs') === 'elevenlabs';
        if (preferEleven) {
          try {
            await speakWithEleven({ text });
            return;
          } catch {
            setError(t('aiVoiceFallbackTts'));
          }
        }

        await speakWithBrowserSynthesis(text, languageRef.current);
      } catch (error) {
        setError(pickVoiceErrorMessage(error, t));
      } finally {
        speakingRef.current = false;
        updateState({
          isSpeaking: false,
          status: stateAfterSpeech(Boolean(pendingTargetRef.current)),
        });
      }
    },
    [t, updateState],
  );

  const handleTranscript = useCallback(
    async (result: TranscriptResult) => {
      const active = activeMatchRef.current;
      const aiPlayer = activeAiFrom(aiPlayersRef.current);
      const settingsValue = settingsRef.current;
      if (!active || !settingsValue || !aiPlayer) {
        return;
      }

      const transcript = result.text.replace(/\s+/g, ' ').trim();
      if (!transcript) {
        return;
      }

      const now = nowMs();
      lastVoiceActivityRef.current = now;

      const pendingTargetId = pendingTargetRef.current;
      const speaker = pendingTargetId ? playerMapRef.current.get(pendingTargetId) ?? null : null;
      const speakerName = speaker?.name ?? t('aiUnknownSpeaker');

      updateState({
        lastTranscript: transcript,
        lastSpeakerName: speakerName,
        status: stateAfterSpeech(Boolean(pendingTargetId)),
        isListening: true,
      });

      await appendMessages(aiPlayer.id, [{ from: 'user', text: asNamedLine(speakerName, transcript) }]);

      if (pendingTargetId) {
        updateSuspicionForSpeaker(pendingTargetId, transcript);
      }

      if (speaker?.kind === 'ai' && speaker.id !== aiPlayer.id) {
        const config = runtimeConfigFromSettings(settingsValue);
        const context = buildContext(active, speaker, languageRef.current, playerMapRef.current);
        const thread = active.ai?.threads?.[speaker.id] ?? buildEmptyThread();
        const { reply } = await generateChatReply(config, context, thread, transcript);
        const line = asNamedLine(speaker.name, reply);
        await appendMessages(speaker.id, [{ from: 'ai', text: line }]);
        await appendMessages(aiPlayer.id, [{ from: 'user', text: line }]);
        await speakWithFallback(line);
        updateState({ lastIntervention: line });
        pendingTargetRef.current = null;
        pendingDeadlineRef.current = 0;
        updateState({ pendingTargetPlayerId: '', pendingTargetName: '', status: 'listening' });
        return;
      }

      if (isYesNoQuestion(transcript)) {
        const config = runtimeConfigFromSettings(settingsValue);
        const context = buildContext(active, aiPlayer, languageRef.current, playerMapRef.current);
        const thread = active.ai?.threads?.[aiPlayer.id] ?? buildEmptyThread();
        const yesNo = await decideYesNo(config, context, thread, transcript);
        const spoken = yesNo === 'yes' ? 'أه' : 'لا';
        const line = asNamedLine(aiPlayer.name, spoken);
        await appendMessages(aiPlayer.id, [{ from: 'ai', text: line }]);
        updateState({ lastIntervention: line });
        await speakWithFallback(line);
        pendingTargetRef.current = null;
        pendingDeadlineRef.current = 0;
        updateState({ pendingTargetPlayerId: '', pendingTargetName: '', status: 'listening' });
        return;
      }

      if (pendingTargetId && (suspicionScoreRef.current[pendingTargetId] ?? 0) >= 2.5) {
        const config = runtimeConfigFromSettings(settingsValue);
        const context = buildContext(active, aiPlayer, languageRef.current, playerMapRef.current);
        const thread = active.ai?.threads?.[aiPlayer.id] ?? buildEmptyThread();
        const interjection = await generateSuspicionInterjection(config, context, thread, speakerName);
        const line = asNamedLine(aiPlayer.name, interjection);
        await appendMessages(aiPlayer.id, [{ from: 'ai', text: line }]);
        updateState({ lastIntervention: line });
        await speakWithFallback(line);
      }

      pendingTargetRef.current = null;
      pendingDeadlineRef.current = 0;
      updateState({
        pendingTargetPlayerId: '',
        pendingTargetName: '',
        status: 'listening',
      });
    },
    [appendMessages, speakWithFallback, t, updateState, updateSuspicionForSpeaker],
  );

  const autoReplyFromAiTarget = useCallback(
    async (active: ActiveMatch, asker: Player, target: Player, question: string) => {
      const settingsValue = settingsRef.current;
      if (!settingsValue) {
        return;
      }

      const config = runtimeConfigFromSettings(settingsValue);
      const targetContext = buildContext(active, target, languageRef.current, playerMapRef.current);
      const targetThread = active.ai?.threads?.[target.id] ?? buildEmptyThread();
      const { reply } = await generateChatReply(config, targetContext, targetThread, question);
      const responseLine = asNamedLine(target.name, reply);

      await appendMessages(target.id, [{ from: 'ai', text: responseLine }]);
      await appendMessages(asker.id, [{ from: 'user', text: responseLine }]);

      updateState({
        lastSpeakerName: target.name,
        lastTranscript: reply,
        lastIntervention: responseLine,
      });

      await speakWithFallback(responseLine);

      pendingTargetRef.current = null;
      pendingDeadlineRef.current = 0;
      updateState({
        pendingTargetPlayerId: '',
        pendingTargetName: '',
        status: 'listening',
      });
    },
    [appendMessages, speakWithFallback, updateState],
  );

  const runIntervention = useCallback(async () => {
    if (interventionLockRef.current || processingRef.current || speakingRef.current) {
      return;
    }

    const active = activeMatchRef.current;
    const aiPlayer = activeAiFrom(aiPlayersRef.current);
    const settingsValue = settingsRef.current;
    if (!active || !aiPlayer || !settingsValue) {
      return;
    }

    interventionLockRef.current = true;
    updateState({ status: 'processing' });

    try {
      const participants = active.match.playerIds
        .map((id) => playerMapRef.current.get(id))
        .filter((player): player is Player => Boolean(player));
      const target = pickNextTargetPlayerId({
        activeAiId: aiPlayer.id,
        participants,
        suspicionScoreByPlayerId: suspicionScoreRef.current,
        cursor: targetCursorRef.current,
      });
      targetCursorRef.current = target.nextCursor;
      if (!target.targetPlayerId) {
        return;
      }

      const targetPlayer = playerMapRef.current.get(target.targetPlayerId);
      if (!targetPlayer) {
        return;
      }

      const config = runtimeConfigFromSettings(settingsValue);
      const context = buildContext(active, aiPlayer, languageRef.current, playerMapRef.current);
      const thread = active.ai?.threads?.[aiPlayer.id] ?? buildEmptyThread();
      const targetScore = suspicionScoreRef.current[targetPlayer.id] ?? 0;
      const mood = targetScore >= 2.5 ? 'suspicious' : 'neutral';

      let speech = '';
      if (targetScore >= 2.5) {
        const interjection = await generateSuspicionInterjection(config, context, thread, targetPlayer.name);
        speech += `${interjection} `;
      }

      const question = await generateDirectedQuestion(config, context, thread, targetPlayer.name, mood);
      speech += `${targetPlayer.name}، ${question}`;
      const line = asNamedLine(aiPlayer.name, speech.trim());

      pendingTargetRef.current = targetPlayer.id;
      pendingDeadlineRef.current = nowMs() + DEFAULT_POST_QUESTION_ANSWER_WINDOW_MS;
      lastInterventionAtRef.current = nowMs();

      await appendMessages(aiPlayer.id, [{ from: 'ai', text: line }]);
      updateState({
        pendingTargetPlayerId: targetPlayer.id,
        pendingTargetName: targetPlayer.name,
        lastIntervention: line,
        status: 'waiting_answer',
      });
      await speakWithFallback(line);

      if (targetPlayer.kind === 'ai' && targetPlayer.id !== aiPlayer.id) {
        await autoReplyFromAiTarget(active, aiPlayer, targetPlayer, question);
      }
    } catch (error) {
      setError(pickVoiceErrorMessage(error, t));
      updateState({
        status: stateAfterSpeech(Boolean(pendingTargetRef.current)),
      });
    } finally {
      interventionLockRef.current = false;
    }
  }, [appendMessages, autoReplyFromAiTarget, speakWithFallback, t, updateState]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    updateState({ status: 'processing', isListening: true });

    try {
      while (queueRef.current.length > 0 && !stopRequestedRef.current) {
        const chunk = queueRef.current.shift();
        if (!chunk) {
          break;
        }

        let transcript: TranscriptResult | null = null;
        const currentLanguage = languageRef.current;
        const currentSettings = settingsRef.current;

        const preferEleven = (currentSettings?.aiVoiceProvider ?? 'elevenlabs') === 'elevenlabs';

        if (preferEleven) {
          try {
            const eleven = await transcribeWithEleven(chunk, currentLanguage);
            transcript = {
              text: eleven.text,
              confidence: typeof eleven.confidence === 'number' ? eleven.confidence : 0.72,
              provider: 'elevenlabs',
            };
          } catch {
            setError(t('aiVoiceFallbackStt'));
          }
        }

        if (!transcript) {
          try {
            const browser = await transcribeWithBrowserRecognition(currentLanguage, 5_000);
            transcript = {
              text: browser.text,
              confidence: browser.confidence,
              provider: 'browser',
            };
          } catch (error) {
            setError(pickVoiceErrorMessage(error, t));
          }
        }

        if (transcript?.text.trim()) {
          await handleTranscript(transcript);
        }
      }
    } finally {
      processingRef.current = false;
      updateState({
        status: stateAfterSpeech(Boolean(pendingTargetRef.current)),
      });
    }
  }, [handleTranscript, t, updateState]);

  const stopAudio = useCallback(() => {
    stopRequestedRef.current = true;

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    recordingRef.current = false;
    queueRef.current = [];
    speechBufferRef.current = [];
    cancelElevenSpeechOutput();
    cancelBrowserSpeechOutput();
    speakingRef.current = false;
  }, []);

  useEffect(() => {
    const canRun =
      Boolean(activeMatch) &&
      activeMatch?.match.status === 'discussion' &&
      Boolean(settings?.aiEnabled) &&
      Boolean(settings?.aiVoiceInputEnabled) &&
      aiPlayers.length > 0 &&
      runtimeEnabled;

    if (!canRun) {
      stopAudio();
      pendingTargetRef.current = null;
      pendingDeadlineRef.current = 0;
      updateState({
        ...defaultState(runtimeEnabled, primaryAi),
      });
      return;
    }

    stopRequestedRef.current = false;
    lastVoiceActivityRef.current = nowMs();
    lastInterventionAtRef.current = 0;
    pendingTargetRef.current = null;
    pendingDeadlineRef.current = 0;
    queueRef.current = [];
    setError('');

    const silenceThresholdMs = Math.max(3_000, settings?.aiSilenceThresholdMs ?? DEFAULT_SILENCE_THRESHOLD_MS);
    const interventionRestMs = Math.max(4_000, settings?.aiInterventionRestMs ?? 9_000);
    const interventionCooldownMs = Math.max(interventionRestMs, Math.floor(silenceThresholdMs * 0.6));
    const timeDomain = new Uint8Array(2048);

    let disposed = false;

    const enqueueChunk = (blob: Blob) => {
      if (!blob || blob.size < MIN_BLOB_BYTES) {
        return;
      }
      queueRef.current.push(blob);
      void processQueue();
    };

    const monitor = () => {
      if (disposed || stopRequestedRef.current) {
        return;
      }

      const analyser = analyserRef.current;
      const recorder = mediaRecorderRef.current;
      if (analyser) {
        analyser.getByteTimeDomainData(timeDomain);
        let sum = 0;
        for (let i = 0; i < timeDomain.length; i += 1) {
          const value = (timeDomain[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / timeDomain.length);
        const now = nowMs();

        if (rms >= VAD_MIN_RMS) {
          lastVoiceActivityRef.current = now;
          if (!speechHoldStartRef.current) {
            speechHoldStartRef.current = now;
          }
        } else {
          speechHoldStartRef.current = 0;
        }

        if (recorder && recorder.state === 'inactive' && speechHoldStartRef.current && now - speechHoldStartRef.current >= VAD_MIN_VOICE_HOLD_MS) {
          speechBufferRef.current = [];
          try {
            recorder.start();
            recordingRef.current = true;
          } catch {
            // ignore
          }
        }

        if (recorder && recorder.state === 'recording' && now - lastVoiceActivityRef.current >= VAD_SILENCE_END_MS) {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
          recordingRef.current = false;
        }

        const silenceMs = Math.max(0, now - lastVoiceActivityRef.current);
        updateState({
          silenceMs,
          isListening: true,
          status: stateAfterSpeech(Boolean(pendingTargetRef.current)),
        });

        if (pendingTargetRef.current && pendingDeadlineRef.current > 0 && now > pendingDeadlineRef.current) {
          pendingTargetRef.current = null;
          pendingDeadlineRef.current = 0;
          updateState({
            pendingTargetPlayerId: '',
            pendingTargetName: '',
            status: 'listening',
          });
        }

        if (
          shouldTriggerSilenceIntervention({
            now,
            lastInterventionAt: lastInterventionAtRef.current,
            lastVoiceActivityAt: lastVoiceActivityRef.current,
            silenceThresholdMs,
            cooldownMs: interventionCooldownMs,
            hasPendingTarget: Boolean(pendingTargetRef.current),
            processing: processingRef.current || interventionLockRef.current,
            speaking: speakingRef.current,
          })
        ) {
          void runIntervention();
        }
      }

      rafRef.current = window.requestAnimationFrame(monitor);
    };

    const bootstrap = async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError(t('aiVoiceUnsupported'));
        updateState({ status: 'idle', isListening: false });
        return;
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

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const AudioContextCtor =
          window.AudioContext ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).webkitAudioContext as typeof AudioContext | undefined);
        if (!AudioContextCtor) {
          stream.getTracks().forEach((track) => track.stop());
          setError(t('aiVoiceUnsupported'));
          return;
        }

        const context = new AudioContextCtor();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);

        const mimeType = detectMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            speechBufferRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(speechBufferRef.current, {
            type: recorder.mimeType || mimeType || 'audio/webm',
          });
          speechBufferRef.current = [];
          enqueueChunk(blob);
        };

        streamRef.current = stream;
        audioContextRef.current = context;
        analyserRef.current = analyser;
        mediaRecorderRef.current = recorder;

        updateState({
          status: 'listening',
          isListening: true,
          isSpeaking: false,
        });
        rafRef.current = window.requestAnimationFrame(monitor);
      } catch {
        setError(t('aiVoiceMicAccessError'));
        updateState({ status: 'idle', isListening: false });
      }
    };

    void bootstrap();

    return () => {
      disposed = true;
      stopAudio();
      updateState({
        status: 'idle',
        isListening: false,
        isSpeaking: false,
      });
    };
  }, [activeMatch, aiPlayers.length, primaryAi, processQueue, runIntervention, runtimeEnabled, settings, stopAudio, t, updateState]);

  return {
    state: {
      ...state,
      runtimeEnabled,
    },
    error,
    runtimeEnabled,
    toggleRuntimeEnabled,
    clearError,
  };
}
