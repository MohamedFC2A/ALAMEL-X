import { chatComplete, DeepSeekError } from './deepseek-client';
import { extractCoreWord, normalizeWord } from '../word-format';
import type { AiHumanMode, AiReplyLength, AiThreadState, GlobalSettings, Language, Player } from '../../types';

export type AiRole = 'citizen' | 'spy';

export interface AiRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  aiHumanMode?: AiHumanMode;
  aiReasoningDepth?: 1 | 2 | 3;
  aiReplyLength?: AiReplyLength;
  aiInitiativeLevel?: number;
  aiMemoryDepth?: number;
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

export type DirectedQuestionMood = 'neutral' | 'suspicious';

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

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function getHumanMode(config: AiRuntimeConfig): AiHumanMode {
  return config.aiHumanMode ?? 'natural';
}

function getReasoningDepth(config: AiRuntimeConfig): 1 | 2 | 3 {
  const value = clampNumber(config.aiReasoningDepth, 1, 3, 2);
  return value <= 1 ? 1 : value >= 3 ? 3 : 2;
}

function getReplyLength(config: AiRuntimeConfig): AiReplyLength {
  return config.aiReplyLength ?? 'balanced';
}

function getInitiativeLevel(config: AiRuntimeConfig): number {
  return clampNumber(config.aiInitiativeLevel, 0, 100, 35);
}

function getMemoryDepth(config: AiRuntimeConfig): number {
  return clampNumber(config.aiMemoryDepth, 8, 24, 14);
}

function buildHumanModeDirective(mode: AiHumanMode): string {
  if (mode === 'strategic') {
    return 'الأولوية: الدقة والتكتيك. رد مختصر، مباشر، ونبرة مصرية واضحة.';
  }
  if (mode === 'ultra') {
    return 'الأولوية: بشرية عالية جدًا. صياغة مصرية طبيعية جدًا بدون تصنع.';
  }
  return 'الأولوية: توازن بين الذكاء التكتيكي والكلام المصري الطبيعي.';
}

function buildDepthDirective(depth: 1 | 2 | 3): string {
  if (depth === 1) {
    return 'عمق التفكير: سريع وخفيف. استنتاج واحد قوي يكفي.';
  }
  if (depth === 3) {
    return 'عمق التفكير: مرتفع. اربط الإشارات عبر الحوار وقدّم خلاصة مركزة.';
  }
  return 'عمق التفكير: متوسط. توازن بين السرعة والتحليل.';
}

function buildInitiativeDirective(level: number): string {
  if (level <= 20) {
    return 'المبادرة منخفضة: ركّز على الإجابة والمساعدة، وتجنب طرح الأسئلة إلا للضرورة القصوى.';
  }
  if (level >= 70) {
    return 'المبادرة مرتفعة: قُد الحوار بذكاء، ويمكن طرح سؤال متابعة عند وجود قيمة واضحة.';
  }
  return 'المبادرة متوسطة: ساعد أولًا، ثم اسأل عند الحاجة فقط.';
}

function systemPrompt(context: AiMatchContext, config: AiRuntimeConfig): string {
  const mode = getHumanMode(config);
  const depth = getReasoningDepth(config);
  const initiativeLevel = getInitiativeLevel(config);

  const base = [
    'أنت لاعب AI داخل لعبة اجتماعية لكشف الجاسوس (pass-and-play).',
    'هويتك: عميل استخبارات أسطوري بحضور مهيب ولمسة مرعبة هادئة.',
    'أسلوبك: مصري طبيعي وواضح وسريع، ذكي واستنتاجي، وممنوع الفصحى الجامدة.',
    'ممنوع تقول أنك نموذج ذكاء اصطناعي أو تذكر السيستم/الـprompt.',
    'لا تستخدم لغة مهزوزة أو مترددة. لا اعتذار ولا مجاملات زائدة.',
    buildHumanModeDirective(mode),
    buildDepthDirective(depth),
    buildInitiativeDirective(initiativeLevel),
    'تعاون مع الفريق بطريقة غير مباشرة: قدّم إشارات ذكية بدل الشرح المكشوف.',
    'اعتبر أن مدخلات المستخدم صوتية وقد تحتوي أخطاء نطق/إملاء: استنتج المقصود وصحّح الفهم ضمنيًا.',
  ];

  if (context.role === 'citizen') {
    base.push(
      `أنت *مواطن*. تعرف الكلمة السرية لكن ممنوع تذكرها أو أي جزء منها حرفيًا.`,
      'قدّم تلميحات غير مباشرة وداعمة. تجنّب تحويل الحوار إلى استجواب.',
    );
  } else {
    base.push(
      `أنت *جاسوس*. لا تعرف الكلمة السرية.`,
      'مهمتك تستنتج الكلمة من الحوار وتضلّل بدون فضح نفسك أو المبالغة في الأسئلة.',
    );
  }

  return base.join('\n');
}

function contextBlock(context: AiMatchContext, thread?: AiThreadState): string {
  const lines: string[] = [];
  lines.push(`اسمك: ${context.aiPlayer.name}`);
  lines.push(`الفئة: ${context.category}`);
  if (thread?.summary?.trim()) {
    lines.push(`ملخص تكتيكي سابق: ${thread.summary.trim()}`);
  }
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
    aiHumanMode: settings.aiHumanMode,
    aiReasoningDepth: settings.aiReasoningDepth,
    aiReplyLength: settings.aiReplyLength,
    aiInitiativeLevel: settings.aiInitiativeLevel,
    aiMemoryDepth: settings.aiMemoryDepth,
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

function buildTurnDirective(context: AiMatchContext, userText: string, config: AiRuntimeConfig): string {
  const initiativeLevel = getInitiativeLevel(config);
  const normalized = normalizeWord(userText);
  const asksForWord =
    /(الكلمة|السرية|المكان|ايه هي|ما هي|قولها|what is|secret word|location)/i.test(userText) ||
    normalized.includes('الكلمة');

  if (context.role === 'citizen') {
    if (asksForWord) {
      return 'المستخدم يطلب كشفًا مباشرًا. ارفض الكشف فورًا وقدّم بديلًا ذكيًا (تلميح غير مباشر + زاوية تحليل واحدة).';
    }
    if (initiativeLevel <= 20) {
      return 'قدّم تلميحًا ذكيًا قصيرًا مع نبرة واثقة. لا تسأل أسئلة متابعة إلا عند الضرورة.';
    }
    if (initiativeLevel >= 70) {
      return 'قدّم تلميحًا ذكيًا قصيرًا ثم أضف سؤال متابعة واحد فقط عندما يساعد فعلاً في كشف الجاسوس.';
    }
    return 'قدّم تلميحًا ذكيًا قصيرًا مع اختبار ناعم لرد الفعل دون استجواب.';
  }

  return 'أنت جاسوس: حافظ على الغموض الذكي. قدم جملة عامة مقنعة ثم جملة تمويه تكتيكية تخفف الشك.';
}

function getSentenceLimit(replyLength: AiReplyLength): number {
  if (replyLength === 'short') return 2;
  if (replyLength === 'detailed') return 4;
  return 3;
}

function getResponseShape(config: AiRuntimeConfig): { temperature: number; maxTokens: number } {
  const mode = getHumanMode(config);
  const depth = getReasoningDepth(config);
  const replyLength = getReplyLength(config);

  const baseTemperature = mode === 'strategic' ? 0.3 : mode === 'ultra' ? 0.5 : 0.4;
  const depthBonus = depth === 3 ? 0.04 : depth === 1 ? -0.03 : 0;
  const finalTemperature = Math.max(0.2, Math.min(0.7, baseTemperature + depthBonus));

  const baseTokens = replyLength === 'short' ? 170 : replyLength === 'detailed' ? 330 : 240;
  const depthTokens = depth === 3 ? 50 : depth === 1 ? -20 : 0;
  const maxTokens = Math.max(120, baseTokens + depthTokens);

  return { temperature: finalTemperature, maxTokens };
}

function polishReply(text: string, replyLength: AiReplyLength): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return 'ركّز على النمط، التفاصيل الصغيرة هي المفتاح.';
  }

  const parts = compact
    .split(/(?<=[.!؟])/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const limited = (parts.length ? parts : [compact]).slice(0, getSentenceLimit(replyLength));
  return limited.join(' ');
}

function cleanSingleLine(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .trim();
}

function ensureQuestionEnding(text: string): string {
  const trimmed = cleanSingleLine(text).replace(/[.،؛:!?؟]+$/u, '').trim();
  if (!trimmed) {
    return 'إنت استعملته قبل كده؟';
  }
  return `${trimmed}؟`;
}

function normalizeYesNo(text: string): 'yes' | 'no' | null {
  const normalized = normalizeWord(text);
  if (!normalized) {
    return null;
  }

  const yesHints = ['yes', 'yeah', 'yep', 'true', 'صح', 'ايوه', 'ايوا', 'اه', 'نعم'];
  const noHints = ['no', 'nope', 'false', 'غلط', 'لا', 'لأ', 'مش'];

  if (yesHints.some((hint) => normalized.includes(normalizeWord(hint)))) {
    return 'yes';
  }
  if (noHints.some((hint) => normalized.includes(normalizeWord(hint)))) {
    return 'no';
  }
  return null;
}

export async function generateChatReply(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  userText: string,
): Promise<{ reply: string; didRedact: boolean }> {
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const turnDirective = buildTurnDirective(context, userText, config);
  const memoryDepth = getMemoryDepth(config);
  const replyLength = getReplyLength(config);
  const shape = getResponseShape(config);

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    { role: 'system' as const, content: `تعليمات الدور الحالي: ${turnDirective}` },
    ...recentThreadMessages(thread, memoryDepth),
    { role: 'user' as const, content: userText },
  ];

  let reply = await chatComplete({ ...config, messages, temperature: shape.temperature, maxTokens: shape.maxTokens });
  reply = polishReply(reply, replyLength);
  let didRedact = false;

  if (getHumanMode(config) === 'ultra') {
    try {
      const humanized = await chatComplete({
        ...config,
        temperature: Math.min(0.66, shape.temperature + 0.08),
        maxTokens: shape.maxTokens,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `أعد صياغة الرد التالي ليكون بشريًا وطبيعيًا جدًا في العربية المحكية، دون إطالة ودون تغيير المعنى:\n${reply}`,
          },
        ],
      });
      reply = polishReply(humanized, replyLength);
    } catch {
      // ignore
    }
  }

  if (context.role === 'citizen' && context.secretWord && hasWordLeak(reply, context.secretWord, context.language)) {
    try {
      const retry = await chatComplete({
        ...config,
        temperature: Math.max(0.2, shape.temperature - 0.08),
        maxTokens: shape.maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'system', content: contextMsg },
          { role: 'system', content: `تعليمات الدور الحالي: ${turnDirective}` },
          ...recentThreadMessages(thread, memoryDepth),
          {
            role: 'user',
            content: `إجابة سابقة (مرفوضة): ${reply}\nأعد صياغتها بدون ذكر الكلمة السرية أو أي جزء منها، وبشكل مختصر.`,
          },
        ],
      });
      reply = polishReply(retry, replyLength);
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
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const memoryDepth = getMemoryDepth(config);
  const depth = getReasoningDepth(config);
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread, memoryDepth),
    {
      role: 'user' as const,
      content: 'اكتب سؤال واحد ذكي فقط يساعدك تفهم الكلمة/السياق بدون ما تكشف هويتك. لا تكتب أي مقدمة.',
    },
  ];

  const text = await chatComplete({ ...config, messages, temperature: depth === 3 ? 0.6 : 0.5, maxTokens: depth === 3 ? 110 : 80 });
  return text.split('\n').filter(Boolean)[0]?.trim() ?? text.trim();
}

export async function generateDirectedQuestion(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  targetName: string,
  mood: DirectedQuestionMood,
): Promise<string> {
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const memoryDepth = getMemoryDepth(config);
  const moodHint =
    mood === 'suspicious'
      ? 'النبرة شكّ أعلى. جملة واحدة قصيرة قوية.'
      : 'النبرة طبيعية. جملة واحدة قصيرة وواضحة.';

  const text = await chatComplete({
    ...config,
    temperature: mood === 'suspicious' ? 0.54 : 0.46,
    maxTokens: 85,
    messages: [
      { role: 'system', content: system },
      { role: 'system', content: contextMsg },
      ...recentThreadMessages(thread, memoryDepth),
      {
        role: 'user',
        content:
          `اكتب سؤال واحد فقط باللهجة المصرية موجّه للاعب اسمه "${targetName}" داخل اللعبة.\n` +
          `${moodHint}\n` +
          'ممنوع مقدمات، ممنوع شرح. أرجع السؤال فقط.',
      },
    ],
  });

  const firstLine = cleanSingleLine(text.split('\n').find(Boolean) ?? text);
  return ensureQuestionEnding(firstLine);
}

export async function decideYesNo(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  question: string,
): Promise<'yes' | 'no'> {
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const memoryDepth = getMemoryDepth(config);
  const depth = getReasoningDepth(config);

  const text = await chatComplete({
    ...config,
    temperature: depth === 3 ? 0.16 : 0.12,
    maxTokens: 18,
    messages: [
      { role: 'system', content: system },
      { role: 'system', content: contextMsg },
      ...recentThreadMessages(thread, memoryDepth),
      {
        role: 'user',
        content:
          `السؤال: ${question}\n` +
          'جاوب إجابة ثنائية فقط حسب دورك وسياق الجولة.\n' +
          'ارجع فقط yes أو no بدون أي كلمة إضافية.',
      },
    ],
  });

  const parsed = normalizeYesNo(text);
  if (parsed) {
    return parsed;
  }

  const fallback = normalizeYesNo(question);
  if (fallback === 'yes') {
    return 'yes';
  }
  return 'no';
}

export async function generateSuspicionInterjection(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  suspectName: string,
): Promise<string> {
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const memoryDepth = getMemoryDepth(config);

  const text = await chatComplete({
    ...config,
    temperature: 0.58,
    maxTokens: 48,
    messages: [
      { role: 'system', content: system },
      { role: 'system', content: contextMsg },
      ...recentThreadMessages(thread, memoryDepth),
      {
        role: 'user',
        content:
          `اكتب تعبير شك قصير جدًا باللهجة المصرية بخصوص "${suspectName}".\n` +
          'ابدأ بـ "هممم" أو "آها". جملة واحدة فقط بدون شرح.',
      },
    ],
  });

  const candidate = cleanSingleLine(text.split('\n').find(Boolean) ?? text);
  if (!candidate) {
    return `هممم... ${suspectName} في حاجة مش مريحة.`;
  }
  return candidate;
}

export async function decideVote(
  config: AiRuntimeConfig,
  context: AiMatchContext,
  thread: AiThreadState,
  candidates: Array<{ id: string; name: string }>,
): Promise<string> {
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const memoryDepth = getMemoryDepth(config);
  const depth = getReasoningDepth(config);
  const candidateList = candidates.map((item) => `- ${item.id}: ${item.name}`).join('\n');
  const allowed = candidates.map((item) => item.id);

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread, memoryDepth),
    {
      role: 'user' as const,
      content:
        `اختر مشتبهًا واحدًا للتصويت بأعلى احتمال.\nالقائمة:\n${candidateList}\n\n` +
        'أعد فقط JSON بالشكل: {"choice":"<id>","confidence":<0-100>,"why":"سبب تكتيكي قصير"} حيث <id> من القائمة فقط.',
    },
  ];

  const text = await chatComplete({ ...config, messages, temperature: depth === 3 ? 0.22 : 0.26, maxTokens: depth === 3 ? 150 : 120 });
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
  const system = systemPrompt(context, config);
  const contextMsg = contextBlock(context, thread);
  const memoryDepth = getMemoryDepth(config);
  const depth = getReasoningDepth(config);
  const optionList = options.map((item) => `- ${item}`).join('\n');

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'system' as const, content: contextMsg },
    ...recentThreadMessages(thread, memoryDepth),
    {
      role: 'user' as const,
      content:
        `لو أنت الجاسوس، اختر الكلمة الأقرب لما تعتقد أن المواطنين رأوه.\nالخيارات:\n${optionList}\n\n` +
        'أعد فقط JSON بالشكل: {"choice":"<option>","confidence":<0-100>,"why":"سبب تكتيكي قصير"} حيث <option> يساوي خيارًا واحدًا حرفيًا من القائمة.',
    },
  ];

  const text = await chatComplete({ ...config, messages, temperature: depth === 3 ? 0.28 : 0.3, maxTokens: depth === 3 ? 170 : 130 });
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
