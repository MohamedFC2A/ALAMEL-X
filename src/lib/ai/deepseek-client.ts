export type DeepSeekChatRole = 'system' | 'user' | 'assistant';

export interface DeepSeekChatMessage {
  role: DeepSeekChatRole;
  content: string;
}

export type DeepSeekErrorKind = 'auth' | 'rate_limit' | 'network' | 'invalid_response' | 'unknown';

export class DeepSeekError extends Error {
  readonly kind: DeepSeekErrorKind;
  readonly status?: number;

  constructor(message: string, options: { kind: DeepSeekErrorKind; status?: number; cause?: unknown }) {
    super(message);
    this.name = 'DeepSeekError';
    this.kind = options.kind;
    this.status = options.status;
    if (options.cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }
  }
}

export interface DeepSeekChatCompleteOptions {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface DeepSeekChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string; code?: string };
}

const VERCEL_PROXY_CHAT_ENDPOINT = '/api/deepseek/chat';

export async function chatComplete(options: DeepSeekChatCompleteOptions): Promise<string> {
  const {
    model,
    messages,
    temperature = 0.65,
    maxTokens = 280,
    timeoutMs = 15_000,
  } = options;

  if (!model?.trim()) {
    throw new DeepSeekError('Missing DeepSeek model name.', { kind: 'invalid_response' });
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(VERCEL_PROXY_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        maxTokens,
      }),
      signal: controller.signal,
    });

    let payload: DeepSeekChatCompletionResponse | null = null;
    try {
      payload = (await response.json()) as DeepSeekChatCompletionResponse;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const status = response.status;
      const message = payload?.error?.message || `DeepSeek request failed (${status}).`;
      const kind: DeepSeekErrorKind = status === 401 ? 'auth' : status === 429 ? 'rate_limit' : 'unknown';
      throw new DeepSeekError(message, { kind, status });
    }

    const text = payload?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new DeepSeekError('DeepSeek returned an empty response.', { kind: 'invalid_response' });
    }

    return text;
  } catch (error) {
    if (error instanceof DeepSeekError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DeepSeekError('DeepSeek request timed out.', { kind: 'network', cause: error });
    }
    throw new DeepSeekError('DeepSeek request failed due to a network error.', { kind: 'network', cause: error });
  } finally {
    window.clearTimeout(timer);
  }
}
