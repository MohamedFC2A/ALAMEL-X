import type { Difficulty, WordEntry, WordPackPayload } from '../types';
import { db } from './db';
import { shuffle } from './utils';

let cachedWords: WordEntry[] | null = null;
let cachedById: Map<string, WordEntry> | null = null;

export async function loadWordPack(): Promise<WordEntry[]> {
  if (cachedWords) {
    return cachedWords;
  }

  const response = await fetch('/data/word-pack.json');
  if (!response.ok) {
    throw new Error('تعذر تحميل بنك الكلمات.');
  }

  const payload = (await response.json()) as WordPackPayload;
  cachedWords = payload.words;
  cachedById = new Map(payload.words.map((entry) => [entry.id, entry]));
  return payload.words;
}

export async function getWordById(wordId: string): Promise<WordEntry | undefined> {
  if (!cachedById) {
    await loadWordPack();
  }
  return cachedById?.get(wordId);
}

export interface WordPick {
  word: WordEntry;
  decoys: WordEntry[];
  extraDecoy?: WordEntry;
}

function normalizeDecoyKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function chooseBalancedWord(
  words: WordEntry[],
  usage: { wordId: string; category: string; usedAt?: number }[],
): WordPick {
  const usedWordIds = new Set(usage.map((entry) => entry.wordId));
  const unusedWords = words.filter((word) => !usedWordIds.has(word.id));

  if (unusedWords.length === 0) {
    throw new Error('WORD_EXHAUSTED');
  }

  const usedByCategory = usage.reduce<Map<string, number>>((acc, item) => {
    acc.set(item.category, (acc.get(item.category) ?? 0) + 1);
    return acc;
  }, new Map());

  const availableCategories = new Map<string, WordEntry[]>();
  for (const word of unusedWords) {
    const bucket = availableCategories.get(word.category) ?? [];
    bucket.push(word);
    availableCategories.set(word.category, bucket);
  }

  const recentUsage = [...usage]
    .sort((left, right) => (right.usedAt ?? 0) - (left.usedAt ?? 0))
    .slice(0, 4)
    .map((entry) => entry.category);

  const categoryCandidates = [...availableCategories.entries()];
  const categoryScores = categoryCandidates.map(([category]) => {
    const usedCount = usedByCategory.get(category) ?? 0;
    const recentPenalty = recentUsage.includes(category) ? 0.6 : 0;
    return { category, score: usedCount + recentPenalty };
  });

  const minScore = Math.min(...categoryScores.map((item) => item.score));
  const leastUsedCategories = categoryScores
    .filter((item) => item.score === minScore)
    .map((item) => item.category);

  const selectedCategory = shuffle(leastUsedCategories)[0] ?? categoryCandidates[0][0];
  const categoryWords = availableCategories.get(selectedCategory) ?? [];
  const chosenWord = shuffle(categoryWords)[0] ?? unusedWords[0];
  const sameCategoryCandidates = words.filter((word) => word.category === chosenWord.category && word.id !== chosenWord.id);
  const candidateByText = new Map<string, WordEntry>();
  for (const candidate of sameCategoryCandidates) {
    candidateByText.set(normalizeDecoyKey(candidate.text_en), candidate);
    candidateByText.set(normalizeDecoyKey(candidate.text_ar), candidate);
  }

  const preferredDecoys: WordEntry[] = [];
  for (const raw of chosenWord.decoys ?? []) {
    const found = candidateByText.get(normalizeDecoyKey(raw));
    if (!found || preferredDecoys.some((entry) => entry.id === found.id)) {
      continue;
    }
    preferredDecoys.push(found);
    if (preferredDecoys.length >= 3) {
      break;
    }
  }

  const fallbackSameCategory = shuffle(
    sameCategoryCandidates.filter((candidate) => !preferredDecoys.some((entry) => entry.id === candidate.id)),
  );
  const decoys = [...preferredDecoys, ...fallbackSameCategory].slice(0, 3);

  const extraDecoy =
    fallbackSameCategory.find((candidate) => !decoys.some((entry) => entry.id === candidate.id)) ??
    undefined;

  return {
    word: chosenWord,
    decoys,
    extraDecoy,
  };
}

export async function pickBalancedUnusedWord(difficulty: 'any' | Difficulty = 'any'): Promise<WordPick> {
  const words = await loadWordPack();
  const filtered = difficulty === 'any' ? words : words.filter((word) => word.difficulty === difficulty);
  const effectivePool = filtered.length > 0 ? filtered : words;
  const usage = await db.wordUsage.toArray();
  return chooseBalancedWord(effectivePool, usage);
}
