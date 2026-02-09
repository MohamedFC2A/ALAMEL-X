import type { Language } from '../types';

const EXTRA_WORDS = /\b(إضافي|اضافي|additional|variant)\b/gi;
const DIGITS = /[0-9٠-٩]+/g;
const TRAILING_NUMBER = /\s*[0-9٠-٩]+\s*$/g;

const ADJECTIVES_EN = new Set([
  'ancient',
  'hidden',
  'northern',
  'golden',
  'silent',
  'bright',
  'crimson',
  'grand',
  'lonely',
  'emerald',
  'stormy',
  'calm',
  'coastal',
  'urban',
  'wild',
  'sacred',
  'remote',
  'misty',
  'open',
  'dense',
  'rapid',
  'frozen',
  'warm',
  'high',
]);

const ADJECTIVES_AR = new Set([
  'قديم',
  'خفي',
  'شمالي',
  'ذهبي',
  'صامت',
  'لامع',
  'قرمزي',
  'عظيم',
  'وحيد',
  'زمردي',
  'عاصف',
  'هادئ',
  'ساحلي',
  'حضري',
  'بري',
  'مقدس',
  'نائي',
  'ضبابي',
  'مفتوح',
  'كثيف',
  'سريع',
  'متجمد',
  'دافئ',
  'عال',
]);

export function normalizeWord(value: string): string {
  if (!value) {
    return '';
  }

  return value
    .replace(EXTRA_WORDS, ' ')
    .replace(DIGITS, '')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function extractCoreWord(value: string, language: Language): string {
  if (!value) {
    return '';
  }

  const cleaned = value
    .replace(EXTRA_WORDS, ' ')
    .replace(TRAILING_NUMBER, '')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ').filter(Boolean);
  if (tokens.length <= 1) {
    return cleaned;
  }

  const adjectiveSet = language === 'ar' ? ADJECTIVES_AR : ADJECTIVES_EN;
  const remaining = [...tokens];
  while (remaining.length > 1) {
    const next = remaining[0].toLowerCase();
    if (!adjectiveSet.has(next)) {
      break;
    }
    remaining.shift();
  }

  return remaining.join(' ').trim() || cleaned;
}

export function formatWordForDisplay(value: string, language: Language): string {
  if (!value) {
    return '';
  }

  let text = extractCoreWord(value, language);
  text = text.replace(EXTRA_WORDS, ' ').replace(TRAILING_NUMBER, '').replace(/\s+/g, ' ').trim();
  if (language === 'ar') {
    text = text.replace(DIGITS, '').replace(/\s+/g, ' ').trim();
  }

  return text || value.trim();
}
