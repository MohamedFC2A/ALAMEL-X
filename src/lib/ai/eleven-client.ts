import type { ElevenSttRequest, ElevenSttResponse, ElevenTtsRequest, Language } from '../../types';

export type ElevenErrorKind = 'auth' | 'rate_limit' | 'network' | 'invalid_response' | 'unknown';

export class ElevenError extends Error {
  readonly kind: ElevenErrorKind;
  readonly status?: number;

  constructor(message: string, options: { kind: ElevenErrorKind; status?: number; cause?: unknown }) {
    super(message);
    this.name = 'ElevenError';
    this.kind = options.kind;
    this.status = options.status;
    if (options.cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }
  }
}

const ELEVEN_TTS_ENDPOINT = '/api/eleven/tts';
const ELEVEN_STT_ENDPOINT = '/api/eleven/stt';

let playbackNonce = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeFetchAbort: AbortController | null = null;

function classifyStatus(status: number): ElevenErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  return 'unknown';
}

function languageCode(language: Language): string {
  return language === 'ar' ? 'ar' : 'en';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const segment = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...segment);
  }
  return btoa(binary);
}

function cleanupActiveAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch {
      // ignore
    }
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

export function cancelElevenSpeechOutput() {
  playbackNonce += 1;
  activeFetchAbort?.abort();
  activeFetchAbort = null;
  cleanupActiveAudio();
}

export async function transcribeWithEleven(audioBlob: Blob, language: Language): Promise<ElevenSttResponse> {
  const audioBase64 = await blobToBase64(audioBlob);
  const payload: ElevenSttRequest = {
    audioBase64,
    mimeType: audioBlob.type || 'audio/webm',
    languageCode: languageCode(language),
  };

  let response: Response;
  try {
    response = await fetch(ELEVEN_STT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ElevenError('Failed to connect to ElevenLabs STT endpoint.', { kind: 'network', cause: error });
  }

  let data: ElevenSttResponse | null = null;
  try {
    data = (await response.json()) as ElevenSttResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const status = response.status;
    const message =
      (data as unknown as { error?: { message?: string } })?.error?.message || `ElevenLabs STT failed (${status}).`;
    throw new ElevenError(message, { kind: classifyStatus(status), status });
  }

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) {
    throw new ElevenError('ElevenLabs STT returned an empty transcript.', { kind: 'invalid_response' });
  }

  return {
    text,
    confidence: typeof data?.confidence === 'number' ? data.confidence : undefined,
    provider: 'elevenlabs',
  };
}

export async function speakWithEleven(request: ElevenTtsRequest): Promise<void> {
  cancelElevenSpeechOutput();
  const nonce = playbackNonce;

  const text = request.text.trim();
  if (!text) {
    return;
  }

  const abort = new AbortController();
  activeFetchAbort = abort;

  let response: Response;
  try {
    response = await fetch(ELEVEN_TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: abort.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    throw new ElevenError('Failed to connect to ElevenLabs TTS endpoint.', { kind: 'network', cause: error });
  } finally {
    if (activeFetchAbort === abort) {
      activeFetchAbort = null;
    }
  }

  if (!response.ok) {
    let message = `ElevenLabs TTS failed (${response.status}).`;
    try {
      const json = (await response.json()) as { error?: { message?: string } };
      message = json?.error?.message || message;
    } catch {
      // ignore parse error
    }
    throw new ElevenError(message, { kind: classifyStatus(response.status), status: response.status });
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('audio/')) {
    let preview = '';
    try {
      preview = (await response.text()).slice(0, 180).replace(/\s+/g, ' ').trim();
    } catch {
      preview = '';
    }
    const suffix = preview ? ` | preview: ${preview}` : '';
    throw new ElevenError(`ElevenLabs TTS returned non-audio response.${suffix}`, {
      kind: 'invalid_response',
      status: response.status,
    });
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size) {
    throw new ElevenError('ElevenLabs TTS returned empty audio.', { kind: 'invalid_response' });
  }

  if (nonce !== playbackNonce) {
    return;
  }

  cleanupActiveAudio();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.preload = 'auto';
  activeAudio = audio;
  activeAudioUrl = audioUrl;

  await new Promise<void>((resolve, reject) => {
    let ended = false;
    const finish = (error?: unknown) => {
      if (ended) return;
      ended = true;
      audio.onended = null;
      audio.onerror = null;
      if (error) reject(error);
      else resolve();
    };

    audio.onended = () => finish();
    audio.onerror = () => finish(new ElevenError('Failed to play ElevenLabs audio.', { kind: 'unknown' }));

    audio
      .play()
      .then(() => {
        // waiting for onended
      })
      .catch((error) => finish(new ElevenError('Autoplay blocked for ElevenLabs audio.', { kind: 'unknown', cause: error })));
  }).finally(() => {
    if (activeAudio === audio) {
      cleanupActiveAudio();
    }
  });
}
