const ELEVEN_TTS_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 720;

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
  const voiceId = (voiceIdRaw || envVoiceId).trim();
  if (!voiceId) {
    fail(res, 503, 'ElevenLabs voice ID is not configured on the server.', 'missing_voice_id');
    return;
  }

  const modelIdRaw = typeof input.modelId === 'string' ? input.modelId : '';
  const modelId = (modelIdRaw || process.env.ELEVENLABS_TTS_MODEL_ID || DEFAULT_TTS_MODEL).trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
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
        signal: controller.signal,
      },
    );

    if (!upstream.ok) {
      const raw = await upstream.text();
      let message = `ElevenLabs TTS request failed (${upstream.status}).`;
      try {
        const parsed = JSON.parse(raw);
        message = parsed?.detail?.message || parsed?.error?.message || message;
      } catch {
        // ignore parse error
      }
      fail(res, upstream.status, message, 'upstream_tts_failed');
      return;
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
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
