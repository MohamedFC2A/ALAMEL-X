const ELEVEN_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const DEFAULT_STT_MODEL = 'scribe_v1';
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 16;

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

function pickConfidence(payload) {
  if (typeof payload?.confidence === 'number') {
    return Math.max(0, Math.min(1, payload.confidence));
  }
  if (typeof payload?.avg_logprob === 'number') {
    return Math.max(0, Math.min(1, Math.exp(payload.avg_logprob)));
  }
  return undefined;
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
  const audioBase64 = typeof input.audioBase64 === 'string' ? input.audioBase64.trim() : '';
  if (!audioBase64) {
    fail(res, 400, 'audioBase64 is required.', 'invalid_payload');
    return;
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    fail(res, 413, 'audio payload is too large.', 'payload_too_large');
    return;
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, 'base64');
  } catch {
    fail(res, 400, 'audioBase64 is invalid.', 'invalid_payload');
    return;
  }

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    fail(res, 400, 'audio payload is empty.', 'invalid_payload');
    return;
  }
  if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
    fail(res, 413, 'audio payload is too large.', 'payload_too_large');
    return;
  }

  const mimeType = typeof input.mimeType === 'string' && input.mimeType.trim() ? input.mimeType.trim() : 'audio/webm';
  const languageCode =
    typeof input.languageCode === 'string' && input.languageCode.trim()
      ? input.languageCode.trim().toLowerCase().slice(0, 5)
      : 'ar';
  const modelIdRaw = typeof input.modelId === 'string' ? input.modelId : '';
  const modelId = (modelIdRaw || process.env.ELEVENLABS_STT_MODEL_ID || DEFAULT_STT_MODEL).trim();

  const fileExt = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : 'webm';
  const blob = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, `chunk.${fileExt}`);
  formData.append('model_id', modelId);
  formData.append('language_code', languageCode || 'ar');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);

  try {
    const upstream = await fetch(ELEVEN_STT_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
      signal: controller.signal,
    });

    const raw = await upstream.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      const message = payload?.detail?.message || payload?.error?.message || `ElevenLabs STT request failed (${upstream.status}).`;
      fail(res, upstream.status, message, 'upstream_stt_failed');
      return;
    }

    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      fail(res, 502, 'ElevenLabs STT returned an empty transcript.', 'invalid_response');
      return;
    }

    const confidence = pickConfidence(payload);
    res.status(200).json({
      text,
      confidence,
      provider: 'elevenlabs',
    });
  } catch (error) {
    const timedOut = Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
    fail(
      res,
      502,
      timedOut ? 'ElevenLabs STT request timed out.' : 'Failed to connect to ElevenLabs STT upstream.',
      'upstream_request_failed',
    );
  } finally {
    clearTimeout(timer);
  }
}
