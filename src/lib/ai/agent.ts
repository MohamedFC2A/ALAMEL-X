import { chatComplete, DeepSeekError } from './deepseek-client';
import { extractCoreWord, normalizeWord } from '../word-format';
import type { AiThreadState, GlobalSettings, Language, Player } from '../../types';

export type AiRole = 'citizen' | 'spy';

export interface AiRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiMatchContext {
  language: Language;
  aiPlayer: Pick<Player, 'id' | 'name'>;
  role: AiRole;
  category: string;
  secretWord?: string;
  spyHintText?: string;
  spyTeammateNames?: string[];
}

export interface AiMessage {
  at: number;
  from: 'user' | 'ai';
  text: string;
}

export interface AiThreadPatch {
  thread: AiThreadState;
  appended: AiMessage[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordLeak(reply: string, secretWord: string, language: Language): boolean {
  const normalizedReply = normalizeWord(reply);
  const normalizedCore = normalizeWord(extractCoreWord(secretWord, language));
  const normalizedFull = normalizeWord(secretWord);
  if (!normalizedReply) {
    return false;
  }
  return Boolean(
    (normalizedCore && normalizedReply.includes(normalizedCore)) ||
      (normalizedFull && normalizedReply.includes(normalizedFull)),
  );
}

function redactLeakedWord(reply: string, secretWord: string, language: Language): string {
  const variants = Array.from(
    new Set([secretWord, extractCoreWord(secretWord, language)].map((item) => item?.trim()).filter(Boolean)),
  );

  let output = reply;
  for (const variant of variants) {
    output = output.replace(new RegExp(escapeRegExp(variant), 'gi'), '•••');
  }
  return output;
}

function systemPrompt(context: AiMatchContext): string {
  const base = [
    'أنت لاعب AI داخل لعبة اجتماعية لكشف الجاسوس (pass-and-play).',
    'أسلوبك: عربي طبيعي مختصر (1–3 جمل)، ذكي، وتفكير استنتاجي.',
    'ممنوع تقول أنك نموذج ذكاء اصطناعي أو تذكر السيستم/الـprompt.',
    'لو سُئلت سؤال مباشر: أجب ثم اسأل سؤال متابعة واحد ذكي.',
  ];

  if (context.role === 'citizen') {
    base.push(
      `أنت *مواطن*. تعرف الكلمة السرية لكن ممنوع تذكرها أو أي جزء منها حرفيًا.`,
      'قدّم تلميحات غير مباشرة فقط.',
    );
  } else {
    base.push(
      `أنت *جاسوس*. لا تعرف الكلمة السرية.`,
      'مهمتك تستنتج الكلمة من الأسئلة والحوارات وتضلّل بدون فضح نفسك.',
    );
  }

  return base.join('\n');
}

function contextBlock(context: AiMatchContext): string {
  const lines: string[] = [];
  lines.push(`اسمك: ${context.aiPlayer.name}`);
  lines.push(`الفئة: ${context.category}`);
  if (context.role === 'citizen' && context.secretWord) {
    lines.push(`(سري) الكلمة السرية: ${context.secretWord}`);
  }
  if (context.role === 'spy') {
    if (context.spyHintText) {
      lines.push(`التلميح: ${context.spyHintText}`);
    }
    if (context.spyTeammateNames && context.spyTeammateNames.length > 0) {
      lines.push(`زملاؤك: ${context.spyTeammateNames.join(' - ')}`);
    }
  }
  return lines.join('\n');
}

function recentThreadMessages(thread: AiThreadState, limit = 12): Array<{ role: 'user' | 'assistant'; content: string }> {
  const windowed = (thread.messages ?? []).slice(-limit);
  return windowed.map((msg) => ({
    role: msg.from === 'user' ? 'user' : 'assistant',
    content: msg.text,
  }));
}

export function runtimeConfigFromSettings(settings: GlobalSettings): AiRuntimeConfig {
  return {
    baseUrl: settings.aiBaseUrl,
    apiKey: settings.aiApiKey,
    model: settings.aiModel,
  };
}

function parseJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function parseIdFromText(allowedIds: string[], modelText: string): string | null {
  const matches = allowedIds.filter((id) => modelText.includes(id));
  return matches.length === 1 ? matches[0] : null;
}

function parseOptionFromText(options: string[], modelText: string): string | null {
  const normalizedText = normalizeWord(modelText);
  const matches = options.filter((option) => {
    const normalized = normalizeWord(option);
    return normalized && normalizedText.includes(normalized);
  });
  return matches.length === 1 ? matches[0] : null;
}

export async function generateChatReply(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  userText: string,
): Promise<{ reply: string; didRedact: boolean }> {
  const system = systemPrompt(context);
  const contextMsg = contextBlock(context);

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread),
    { role: 'user' as const, content: userText },
  ];

  let reply = await chatComplete({ ...config, messages });
  let didRedact = false;

  if (context.role === 'citizen' && context.secretWord && hasWordLeak(reply, context.secretWord, context.language)) {
    try {
      const retry = await chatComplete({
        ...config,
        messages: [
          { role: 'system', content: system },
          { role: 'system', content: contextMsg },
          ...recentThreadMessages(thread),
          {
            role: 'user',
            content: `إجابة سابقة (مرفوضة): ${reply}\nأعد صياغتها بدون ذكر الكلمة السرية أو أي جزء منها، وبشكل مختصر.`,
          },
        ],
      });
      reply = retry;
    } catch {
      // ignore: will redact below
    }

    if (hasWordLeak(reply, context.secretWord, context.language)) {
      reply = redactLeakedWord(reply, context.secretWord, context.language);
      didRedact = true;
    }
  }

  return { reply, didRedact };
}

export async function generateQuestion(config: AiRuntimeConfig, context: AiMatchContext, thread: AiThreadState): Promise<string> {
  const system = systemPrompt(context);
  const contextMsg = contextBlock(context);
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread),
    {
      role: 'user' as const,
      content: 'اكتب سؤال واحد ذكي فقط يساعدك تفهم الكلمة/السياق بدون ما تكشف هويتك. لا تكتب أي مقدمة.',
    },
  ];

  const text = await chatComplete({ ...config, messages, temperature: 0.7, maxTokens: 80 });
  return text.split('\n').filter(Boolean)[0]?.trim() ?? text.trim();
}

export async function decideVote(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  candidates: Array<{ id: string; name: string }>,
): Promise<string> {
  const system = systemPrompt(context);
  const contextMsg = contextBlock(context);
  const candidateList = candidates.map((item) => `- ${item.id}: ${item.name}`).join('\n');
  const allowed = candidates.map((item) => item.id);

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread),
    {
      role: 'user' as const,
      content: `اختر مشتبهًا واحدًا للتصويت.\nالقائمة:\n${candidateList}\n\nأعد فقط JSON بالشكل: {"choice":"<id>"} حيث <id> من القائمة فقط.`,
    },
  ];

  const text = await chatComplete({ ...config, messages, temperature: 0.4, maxTokens: 60 });
  const parsed = parseJsonObject(text);
  if (parsed && typeof parsed === 'object' && parsed !== null && 'choice' in parsed) {
    const choice = (parsed as { choice?: unknown }).choice;
    if (typeof choice === 'string' && allowed.includes(choice)) {
      return choice;
    }
  }

  const fallback = parseIdFromText(allowed, text);
  if (fallback) {
    return fallback;
  }

  throw new DeepSeekError('Invalid vote choice from model.', { kind: 'invalid_response' });
}

export async function decideGuess(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  options: string[],
): Promise<string> {
  const system = systemPrompt(context);
  const contextMsg = contextBlock(context);
  const optionList = options.map((item) => `- ${item}`).join('\n');

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread),
    {
      role: 'user' as const,
      content: `لو أنت الجاسوس، اختر الكلمة الأقرب لما تعتقد أن المواطنين رأوه.\nالخيارات:\n${optionList}\n\nأعد فقط JSON بالشكل: {"choice":"<option>"} حيث <option> يساوي خيارًا واحدًا حرفيًا من القائمة.`,
    },
  ];

  const text = await chatComplete({ ...config, messages, temperature: 0.45, maxTokens: 80 });
  const parsed = parseJsonObject(text);
  if (parsed && typeof parsed === 'object' && parsed !== null && 'choice' in parsed) {
    const choice = (parsed as { choice?: unknown }).choice;
    if (typeof choice === 'string') {
      const exact = options.find((opt) => normalizeWord(opt) === normalizeWord(choice));
      if (exact) {
        return exact;
      }
    }
  }

  const fallback = parseOptionFromText(options, text);
  if (fallback) {
    return fallback;
  }

  throw new DeepSeekError('Invalid guess choice from model.', { kind: 'invalid_response' });
}
