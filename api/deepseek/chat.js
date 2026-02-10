const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed.' } });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: {
        message: 'DeepSeek API key is not configured on the server.',
        code: 'missing_server_key',
      },
    });
    return;
  }

  const input = parseJsonBody(req.body);
  const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : 'deepseek-chat';
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const temperature = typeof input.temperature === 'number' ? input.temperature : 0.65;
  const maxTokensRaw = typeof input.maxTokens === 'number' ? input.maxTokens : input.max_tokens;
  const maxTokens = typeof maxTokensRaw === 'number' ? maxTokensRaw : 280;

  if (!messages.length) {
    res.status(400).json({ error: { message: 'messages array is required.' } });
    return;
  }

  try {
    const upstream = await fetch(DEEPSEEK_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    const raw = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(raw || '{}');
  } catch {
    res.status(502).json({
      error: {
        message: 'Failed to connect to DeepSeek upstream.',
        code: 'upstream_request_failed',
      },
    });
  }
}
