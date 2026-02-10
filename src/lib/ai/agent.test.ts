import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatCompleteMock = vi.hoisted(() => vi.fn());

vi.mock('./deepseek-client', () => {
  class DeepSeekError extends Error {
    kind: string;
    status?: number;

    constructor(message: string, options: { kind: string; status?: number }) {
      super(message);
      this.name = 'DeepSeekError';
      this.kind = options.kind;
      this.status = options.status;
    }
  }

  return {
    chatComplete: chatCompleteMock,
    DeepSeekError,
  };
});

import { decideGuess, decideVote, decideVoteDetailed, decideYesNo, generateChatReply } from './agent';
import type { AiThreadState } from '../../types';

describe('ai agent', () => {
  const config = { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'test-key', model: 'deepseek-chat' };

  beforeEach(() => {
    chatCompleteMock.mockReset();
  });

  it('retries when citizen reply leaks the secret word', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'citizen' as const,
      category: 'أماكن',
      secretWord: 'ميدان عام',
    };

    chatCompleteMock
      .mockResolvedValueOnce('الكلمة السرية هي ميدان عام.')
      .mockResolvedValueOnce('تلميح: مكان يتجمع فيه الناس كثيرًا.');

    const result = await generateChatReply(config, context, thread, 'اديني تلميح');
    expect(result.reply).toContain('تلميح');
    expect(result.reply).not.toContain('ميدان عام');
    expect(result.didRedact).toBe(false);
    expect(chatCompleteMock).toHaveBeenCalledTimes(2);
  });

  it('redacts the secret word when retry still leaks', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل ندى' },
      role: 'citizen' as const,
      category: 'أماكن',
      secretWord: 'محطة مترو',
    };

    chatCompleteMock
      .mockResolvedValueOnce('هي محطة مترو.')
      .mockResolvedValueOnce('أكيد هي محطة مترو.');

    const result = await generateChatReply(config, context, thread, 'ما هي الكلمة؟');
    expect(result.didRedact).toBe(true);
    expect(result.reply).not.toContain('محطة مترو');
    expect(result.reply).toContain('•••');
    expect(chatCompleteMock).toHaveBeenCalledTimes(2);
  });

  it('decides a vote only from the candidate list', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'spy' as const,
      category: 'أماكن',
      spyHintText: 'ركّز على نوع المكان.',
      spyTeammateNames: [],
    };

    chatCompleteMock.mockResolvedValueOnce('{"choice":"p2"}');

    const choice = await decideVote(config, context, thread, [
      { id: 'p1', name: 'لاعب ١' },
      { id: 'p2', name: 'لاعب ٢' },
    ]);

    expect(choice).toBe('p2');
  });

  it('returns an egyptian suspicion reason when deciding vote', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'citizen' as const,
      category: 'أماكن',
      secretWord: 'ميدان عام',
    };

    chatCompleteMock.mockResolvedValueOnce('{"choice":"p2","why":"بيجاوب بطريقة متناقضة"}');

    const decision = await decideVoteDetailed(config, context, thread, [
      { id: 'p1', name: 'لاعب ١' },
      { id: 'p2', name: 'محمد' },
    ]);

    expect(decision.choice).toBe('p2');
    expect(decision.reason).toContain('أنا شاكك في');
    expect(decision.reason).toContain('محمد');
  });

  it('keeps chat replies concise and tactical by default', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'citizen' as const,
      category: 'أماكن',
      secretWord: 'ميدان عام',
    };

    chatCompleteMock.mockResolvedValueOnce('الأثر واضح جدًا. راقب طريقة الوصف. واسحب النقاش بعيدًا عن السؤال المباشر.');

    const result = await generateChatReply(config, context, thread, 'قول حاجة قوية');
    const sentenceCount = result.reply.split(/(?<=[.!؟])/u).filter(Boolean).length;
    expect(sentenceCount).toBeLessThanOrEqual(3);
  });

  it('respects short reply length setting for tighter output', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'citizen' as const,
      category: 'أماكن',
      secretWord: 'ميدان عام',
    };

    chatCompleteMock.mockResolvedValueOnce('الأثر واضح جدًا. راقب طريقة الوصف. واسحب النقاش بعيدًا عن السؤال المباشر.');

    const result = await generateChatReply({ ...config, aiReplyLength: 'short' }, context, thread, 'قول حاجة قوية');
    const sentenceCount = result.reply.split(/(?<=[.!؟])/u).filter(Boolean).length;
    expect(sentenceCount).toBeLessThanOrEqual(2);
  });

  it('rejects invalid vote choices', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'spy' as const,
      category: 'أماكن',
      spyHintText: 'ركّز على نوع المكان.',
      spyTeammateNames: [],
    };

    chatCompleteMock.mockResolvedValueOnce('{"choice":"nope"}');

    await expect(
      decideVote(config, context, thread, [
        { id: 'p1', name: 'لاعب ١' },
        { id: 'p2', name: 'لاعب ٢' },
      ]),
    ).rejects.toThrow();
  });

  it('decides a guess from the options list', async () => {
    const thread: AiThreadState = {
      messages: [
        { at: 1, from: 'user', text: 'محمد: واضح إنها مرتبطة بالمواصلات وزحمة المترو.' },
        { at: 2, from: 'user', text: 'سارة: غالبًا مكان فيه محطة مترو.' },
      ],
      summary: 'النقاش بيميل لمواصلات عامة ومحطات.',
    };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'spy' as const,
      category: 'أماكن',
      spyHintText: 'ركّز على نوع المكان.',
      spyTeammateNames: [],
    };

    chatCompleteMock.mockResolvedValueOnce('{"choice":"محطة مترو","confidence":84,"why":"إشارات اللاعبين كانت على النقل"}');

    const guess = await decideGuess(config, context, thread, ['ميدان عام', 'محطة مترو', 'شارع جانبي']);
    expect(guess).toBe('محطة مترو');
  });

  it('uses evidence-based fallback when spy guess response is invalid', async () => {
    const thread: AiThreadState = {
      messages: [
        { at: 1, from: 'user', text: 'رامي: غالبًا الكلام على المطار والسفر.' },
        { at: 2, from: 'user', text: 'نهى: أنا حاسة إنها قاعة انتظار في مطار.' },
      ],
      summary: 'السياق كله عن سفر وطيران.',
    };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'spy' as const,
      category: 'أماكن',
      spyHintText: 'مكان مرتبط بالتنقل.',
      spyTeammateNames: [],
    };

    chatCompleteMock.mockResolvedValueOnce('مش عارف بصراحة');

    const guess = await decideGuess(config, context, thread, ['ملعب كرة', 'مطار دولي', 'متحف فني']);
    expect(guess).toBe('مطار دولي');
  });

  it('does not trust overconfident spy guess when evidence points elsewhere', async () => {
    const thread: AiThreadState = {
      messages: [
        { at: 1, from: 'user', text: 'سلمى: كل الكلام عن مكتبة وكتب وقراءة.' },
        { at: 2, from: 'user', text: 'كريم: أكيد حاجة شبه مكتبة عامة.' },
      ],
      summary: 'المجموعة مركزة على القراءة والكتب.',
    };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'spy' as const,
      category: 'أماكن',
      spyHintText: 'مكان هادي.',
      spyTeammateNames: [],
    };

    chatCompleteMock.mockResolvedValueOnce('{"choice":"سوق شعبي","confidence":97,"why":"تخمين سريع"}');

    const guess = await decideGuess(config, context, thread, ['مكتبة عامة', 'سوق شعبي', 'محطة وقود']);
    expect(guess).toBe('مكتبة عامة');
  });

  it('returns strict yes/no decisions for binary questions', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'citizen' as const,
      category: 'أماكن',
      secretWord: 'ميدان عام',
    };

    chatCompleteMock.mockResolvedValueOnce('yes');
    const first = await decideYesNo(config, context, thread, 'هل المكان ده يؤكل؟');
    expect(first).toBe('yes');

    chatCompleteMock.mockResolvedValueOnce('no');
    const second = await decideYesNo(config, context, thread, 'هل المكان ده داخل بيت؟');
    expect(second).toBe('no');
  });

  it('makes spy replies sound uncertain instead of confidently knowing the word', async () => {
    const thread: AiThreadState = { messages: [], summary: '' };
    const context = {
      language: 'ar' as const,
      aiPlayer: { id: 'ai1', name: 'العميل صقر' },
      role: 'spy' as const,
      category: 'أماكن',
      spyHintText: 'ركّز على الفئة',
      spyTeammateNames: [],
    };

    chatCompleteMock.mockResolvedValueOnce('أكيد هي محطة مترو ومفيش احتمال تاني.');

    const result = await generateChatReply(config, context, thread, 'قول رأيك');
    expect(result.reply).toContain('مش متأكد');
    expect(result.reply).not.toMatch(/أكيد|مؤكد/u);
  });
});
