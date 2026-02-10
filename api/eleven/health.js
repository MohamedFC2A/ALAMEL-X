const ELEVEN_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';
const VOICE_PREVIEW_LIMIT = 20;

function fail(res, status, message, code, details) {
  res.status(status).json({
    ok: false,
    error: {
      message,
      code,
      details: details || '',
    },
  });
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
  if (voice?.deleted || voice?.status === 'deleted') score -= 120;
  return score;
}

function toVoicePreview(voice) {
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {};
  return {
    id: String(voice?.voice_id || ''),
    name: String(voice?.name || ''),
    category: String(voice?.category || ''),
    language: String(labels.language || labels.locale || labels.accent || ''),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    fail(res, 405, 'Method not allowed.', 'method_not_allowed');
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    fail(res, 503, 'ElevenLabs API key is not configured on the server.', 'missing_server_key');
    return;
  }

  const preferredVoiceId = String(process.env.ELEVENLABS_VOICE_ID || '').trim();
  const preferredNameLower = String(process.env.ELEVENLABS_VOICE_NAME || '').trim().toLowerCase();
  const modelId = String(process.env.ELEVENLABS_TTS_MODEL_ID || DEFAULT_TTS_MODEL).trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const upstream = await fetch(ELEVEN_VOICES_URL, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        accept: 'application/json',
      },
      signal: controller.signal,
    });

    const raw = await upstream.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    if (!upstream.ok) {
      const message = payload?.detail?.message || payload?.error?.message || `ElevenLabs voices request failed (${upstream.status}).`;
      fail(res, upstream.status, message, 'upstream_voices_failed', raw.slice(0, 800));
      return;
    }

    const voices = Array.isArray(payload?.voices) ? payload.voices : [];
    if (!voices.length) {
      fail(res, 502, 'No voices available in ElevenLabs account.', 'no_voices_available');
      return;
    }

    let selected = null;
    if (preferredVoiceId) {
      selected = voices.find((voice) => String(voice?.voice_id || '') === preferredVoiceId) || null;
    }

    if (!selected) {
      const ranked = [...voices]
        .filter((voice) => !voice?.deleted && voice?.status !== 'deleted')
        .sort((left, right) => scoreVoice(right, preferredNameLower) - scoreVoice(left, preferredNameLower));
      selected = ranked[0] || voices[0];
    }

    const selectedVoice = toVoicePreview(selected);
    const preview = voices
      .map((voice) => toVoicePreview(voice))
      .filter((voice) => voice.id && voice.name)
      .slice(0, VOICE_PREVIEW_LIMIT);

    res.status(200).json({
      ok: true,
      provider: 'elevenlabs',
      modelId,
      configuredVoiceId: preferredVoiceId || null,
      selectedVoice,
      voicesCount: voices.length,
      voicesPreview: preview,
    });
  } catch (error) {
    const timedOut = Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
    fail(
      res,
      502,
      timedOut ? 'ElevenLabs health check timed out.' : 'Failed to connect to ElevenLabs voices endpoint.',
      'upstream_request_failed',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}
