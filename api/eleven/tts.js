const ELEVEN_TTS_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const ELEVEN_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 720;
const VOICE_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedVoice = { id: '', at: 0 };

function parseJsonBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function fail(res, status, message, code) {
  res.status(status).json({ error: { message, code } });
}

function scoreVoice(voice, preferredNameLower) {
  const name = String(voice?.name || '').toLowerCase();
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {};
  const language = String(labels.language || labels.locale || labels.accent || '').toLowerCase();

  let score = 0;
  if (preferredNameLower && name.includes(preferredNameLower)) score += 60;
  if (/(arabic|ar|egypt|egyptian|masr|misr)/.test(language)) score += 50;
  if (/(arabic|egypt|egyptian|masr|misr)/.test(name)) score += 24;
  if (voice?.category === 'premade') score += 8;
  if (voice?.fine_tuning?.state === 'fine_tuned') score += 8;
  if (voice?.is_legacy) score -= 4;
  if (voice?.deleted || voice?.status === 'deleted') score -= 120;
  return score;
}

async function listVoices(apiKey, signal) {
  const response = await fetch(ELEVEN_VOICES_URL, {
    method: 'GET',
    headers: { 'xi-api-key': apiKey, accept: 'application/json' },
    signal,
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.detail?.message || payload?.error?.message || `ElevenLabs voices request failed (${response.status}).`;
    throw new Error(message);
  }

  return Array.isArray(payload?.voices) ? payload.voices : [];
}

async function requestTts({ apiKey, voiceId, modelId, text, signal }) {
  const upstream = await fetch(
    `${ELEVEN_TTS_BASE_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        accept: 'audio/mpeg',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.46,
          similarity_boost: 0.74,
          style: 0.34,
          use_speaker_boost: true,
        },
      }),
      signal,
    },
  );

  let raw = '';
  let parsed = {};
  let audioBuffer = null;
  if (upstream.ok) {
    audioBuffer = Buffer.from(await upstream.arrayBuffer());
  } else {
    raw = await upstream.text();
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
  }

  return {
    ok: upstream.ok,
    status: upstream.status,
    message: parsed?.detail?.message || parsed?.error?.message || `ElevenLabs TTS request failed (${upstream.status}).`,
    raw,
    audioBuffer,
    contentType: upstream.headers.get('content-type') || 'audio/mpeg',
  };
}

function isVoiceNotFound(status, message) {
  if (status !== 404) return false;
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('voice_id') && normalized.includes('not found');
}

async function resolveVoiceId(apiKey, preferredVoiceId, signal) {
  const now = Date.now();
  if (preferredVoiceId) {
    return preferredVoiceId;
  }

  if (!preferredVoiceId && cachedVoice.id && now - cachedVoice.at < VOICE_CACHE_TTL_MS) {
    return cachedVoice.id;
  }

  const voices = await listVoices(apiKey, signal);
  if (!voices.length) {
    throw new Error('No voices available in ElevenLabs account.');
  }

  if (preferredVoiceId) {
    const exact = voices.find((voice) => String(voice?.voice_id || '') === preferredVoiceId);
    if (exact) {
      cachedVoice = { id: preferredVoiceId, at: now };
      return preferredVoiceId;
    }
  }

  const preferredNameLower = String(process.env.ELEVENLABS_VOICE_NAME || '').trim().toLowerCase();
  const ranked = [...voices]
    .filter((voice) => !voice?.deleted && voice?.status !== 'deleted')
    .sort((left, right) => scoreVoice(right, preferredNameLower) - scoreVoice(left, preferredNameLower));

  const picked = ranked[0] || voices[0];
  const pickedId = String(picked?.voice_id || '').trim();
  if (!pickedId) {
    throw new Error('Failed to resolve a valid ElevenLabs voice ID.');
  }

  cachedVoice = { id: pickedId, at: now };
  return pickedId;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed.', 'method_not_allowed');
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    fail(res, 503, 'ElevenLabs API key is not configured on the server.', 'missing_server_key');
    return;
  }

  const input = parseJsonBody(req.body);
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) {
    fail(res, 400, 'text is required.', 'invalid_payload');
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    fail(res, 413, `text is too long (max ${MAX_TEXT_LENGTH} chars).`, 'payload_too_large');
    return;
  }

  const voiceIdRaw = typeof input.voiceId === 'string' ? input.voiceId : '';
  const envVoiceId = process.env.ELEVENLABS_VOICE_ID || '';
  const preferredVoiceId = (voiceIdRaw || envVoiceId).trim();

  const modelIdRaw = typeof input.modelId === 'string' ? input.modelId : '';
  const modelId = (modelIdRaw || process.env.ELEVENLABS_TTS_MODEL_ID || DEFAULT_TTS_MODEL).trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    let voiceId = await resolveVoiceId(apiKey, preferredVoiceId, controller.signal);
    let tts = await requestTts({
      apiKey,
      voiceId,
      modelId,
      text,
      signal: controller.signal,
    });

    if (!tts.ok && isVoiceNotFound(tts.status, tts.message)) {
      try {
        // Retry once with an auto-resolved valid voice when configured voice_id is stale/invalid.
        cachedVoice = { id: '', at: 0 };
        const fallbackVoiceId = await resolveVoiceId(apiKey, '', controller.signal);
        if (fallbackVoiceId && fallbackVoiceId !== voiceId) {
          voiceId = fallbackVoiceId;
          tts = await requestTts({
            apiKey,
            voiceId,
            modelId,
            text,
            signal: controller.signal,
          });
        }
      } catch {
        // keep original failure below
      }
    }

    if (!tts.ok) {
      fail(res, tts.status, tts.message, 'upstream_tts_failed');
      return;
    }

    const audioBuffer = tts.audioBuffer;
    if (!audioBuffer || !audioBuffer.byteLength) {
      fail(res, 502, 'ElevenLabs TTS returned empty audio buffer.', 'invalid_response');
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', tts.contentType || 'audio/mpeg');
    res.setHeader('Content-Length', String(audioBuffer.byteLength));
    res.send(audioBuffer);
  } catch (error) {
    const timedOut = Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
    fail(
      res,
      502,
      timedOut ? 'ElevenLabs TTS request timed out.' : 'Failed to connect to ElevenLabs TTS upstream.',
      'upstream_request_failed',
    );
  } finally {
    clearTimeout(timer);
  }
}
