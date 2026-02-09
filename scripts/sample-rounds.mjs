// sample-rounds.mjs — Simulates 200 rounds of word selection and reports stats
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filePath = resolve(process.cwd(), 'public', 'data', 'word-pack.json');
const raw = readFileSync(filePath, 'utf-8');
const pack = JSON.parse(raw);
const words = pack.words;

const ROUNDS = 200;

function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function normalizeWord(text) {
    return text.toLowerCase().replace(/[\u064B-\u065F\u0610-\u061A]/g, '').trim();
}

// Simulate chooseBalancedWord logic
const usedWordIds = new Set();
const usageByCategory = new Map();
const recentCategories = [];
const selectedWords = [];

for (let round = 0; round < ROUNDS; round++) {
    const unusedWords = words.filter((w) => !usedWordIds.has(w.id));

    if (unusedWords.length === 0) {
        console.log(`\n⚠️  Word pool exhausted at round ${round + 1}.`);
        break;
    }

    // Category balancing
    const availableCategories = new Map();
    for (const w of unusedWords) {
        const bucket = availableCategories.get(w.category) || [];
        bucket.push(w);
        availableCategories.set(w.category, bucket);
    }

    const categoryScores = [...availableCategories.keys()].map((cat) => {
        const used = usageByCategory.get(cat) || 0;
        const recentPenalty = recentCategories.slice(0, 4).includes(cat) ? 0.6 : 0;
        return { category: cat, score: used + recentPenalty };
    });

    const minScore = Math.min(...categoryScores.map((s) => s.score));
    const leastUsed = categoryScores.filter((s) => s.score === minScore).map((s) => s.category);
    const selectedCategory = shuffle(leastUsed)[0];

    const categoryWords = availableCategories.get(selectedCategory);
    const chosenWord = shuffle(categoryWords)[0];

    usedWordIds.add(chosenWord.id);
    usageByCategory.set(selectedCategory, (usageByCategory.get(selectedCategory) || 0) + 1);
    recentCategories.unshift(selectedCategory);
    if (recentCategories.length > 6) recentCategories.pop();

    selectedWords.push(chosenWord);
}

// ─── Reports ───
console.log(`\n🎲 Simulated ${selectedWords.length} rounds out of ${ROUNDS} requested.`);
console.log(`📦 Total words in pool: ${words.length}`);
console.log(`📦 Remaining after simulation: ${words.length - usedWordIds.size}`);

// Category distribution in selection
console.log('\n📊 Category Selection Distribution:');
const selCatCount = {};
for (const w of selectedWords) {
    selCatCount[w.category] = (selCatCount[w.category] || 0) + 1;
}
const sorted = Object.entries(selCatCount).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sorted) {
    const pct = ((count / selectedWords.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`  ${cat.padEnd(12)} ${String(count).padStart(4)} (${pct}%)  ${bar}`);
}

// Difficulty distribution in selection
console.log('\n📊 Difficulty Selection Distribution:');
const selDiffCount = {};
for (const w of selectedWords) {
    selDiffCount[w.difficulty] = (selDiffCount[w.difficulty] || 0) + 1;
}
for (const [diff, count] of Object.entries(selDiffCount)) {
    const pct = ((count / selectedWords.length) * 100).toFixed(1);
    console.log(`  ${diff.padEnd(8)} ${String(count).padStart(4)} (${pct}%)`);
}

// Repetition check
const wordTexts = selectedWords.map((w) => normalizeWord(w.text_ar));
const unique = new Set(wordTexts);
if (unique.size < wordTexts.length) {
    console.warn(`\n⚠️  ${wordTexts.length - unique.size} repeated words in ${selectedWords.length} rounds.`);
} else {
    console.log(`\n✅ No repeated words in ${selectedWords.length} rounds.`);
}
