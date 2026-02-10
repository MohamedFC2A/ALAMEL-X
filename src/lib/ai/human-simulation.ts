import { normalizeWord } from '../word-format';
import type { AiAdaptiveStats, AiHumanMode } from '../../types';

type HumanSimulationRole = 'citizen' | 'spy';

export interface HumanSimulationPolicy {
  active: boolean;
  personaDirective: string;
  interactionPolicy: string;
  comedyPolicy: string;
}

export interface HumanTurnSignals {
  isQuestion: boolean;
  isShortAnswer: boolean;
  asksForClarification: boolean;
}

export function isHumanSimulationActive(mode: AiHumanMode | undefined, enabled: boolean | undefined): boolean {
  return mode === 'ultra' && Boolean(enabled);
}

function buildAdaptiveStyleHint(stats: AiAdaptiveStats | undefined): string {
  if (!stats || stats.matchesPlayed < 2) {
    return 'أسلوبك ثابت وهادي: ردود بشرية واضحة مع مرونة بسيطة.';
  }

  const captureDenominator = stats.successfulCaptures + stats.missedCaptures;
  const captureRate = captureDenominator > 0 ? stats.successfulCaptures / captureDenominator : 0;
  const guessDenominator = stats.successfulSpyGuesses + stats.failedSpyGuesses;
  const guessRate = guessDenominator > 0 ? stats.successfulSpyGuesses / guessDenominator : 0;

  if (captureRate < 0.45) {
    return 'لو الشك منخفض، زوّد أسئلة التوضيح القصيرة بدل الاستنتاج السريع.';
  }
  if (guessRate < 0.45) {
    return 'في دور الجاسوس، حافظ على الغموض واطلب إشارات إضافية قبل الحسم.';
  }
  if (stats.averageSignalStrength >= 52) {
    return 'الإشارات قوية غالبًا: اختصر أكثر وكن حاسمًا لكن بدون يقين مبالغ.';
  }
  return 'وازن بين الحسم والمرونة حسب قوة الإشارات.';
}

export function buildHumanSimulationPolicy(params: {
  mode?: AiHumanMode;
  enabled?: boolean;
  role: HumanSimulationRole;
  stats?: AiAdaptiveStats;
}): HumanSimulationPolicy {
  const active = isHumanSimulationActive(params.mode, params.enabled);
  if (!active) {
    return {
      active: false,
      personaDirective: '',
      interactionPolicy: '',
      comedyPolicy: '',
    };
  }

  const roleHint =
    params.role === 'spy'
      ? 'أنت جاسوس: تصرف بذكاء غامض، لا ادعاء معرفة، ولا يقين مطلق.'
      : 'أنت مواطن: واضح وواثق لكن بدون كشف الكلمة أو الاستعراض.';

  return {
    active: true,
    personaDirective:
      'محاكاة البشر مفعلة: اتكلم كإنسان مصري حقيقي، طبيعي، متفاعل، ومتنوع الأسلوب. ' +
      'غيّر الإيقاع بين جملة قصيرة وأخرى أوضح، وابتعد عن القوالب المكررة.' +
      ` ${roleHint}`,
    interactionPolicy:
      'سياسة التفاعل: السؤال الواضح = رد مباشر. السؤال المبهم = توضيح قصير قبل الإجابة. ' +
      'الإجابة القصيرة من اللاعب = متابعة ذكية واحدة فقط عند الحاجة. ' +
      buildAdaptiveStyleHint(params.stats),
    comedyPolicy:
      'سياسة الكوميديا: مسموح بخفة دم ذكية وخفيفة مرتبطة بالسياق فقط، بدون تهريج زائد، ' +
      'وبدون سخرية شخصية أو خروج عن اللعبة.',
  };
}

export function detectHumanTurnSignals(text: string): HumanTurnSignals {
  const normalized = normalizeWord(text).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return {
      isQuestion: false,
      isShortAnswer: false,
      asksForClarification: false,
    };
  }

  const words = normalized.split(' ').filter(Boolean);
  const isQuestion =
    /[؟?]\s*$/.test(text.trim()) ||
    /(^|\s)(ايه|ليه|ازاي|فين|امتي|what|why|how|when|where|who|هل)(\s|$)/i.test(normalized);
  const isShortAnswer =
    words.length <= 4 ||
    /(^|\s)(اه|ايوه|لا|يمكن|تقريبا|مش عارف|yes|no|maybe)(\s|$)/u.test(normalized);
  const asksForClarification =
    /(^|\s)(يعني|مش فاهم|وضح|فسر|clarify|explain|what do you mean)(\s|$)/i.test(normalized);

  return { isQuestion, isShortAnswer, asksForClarification };
}
