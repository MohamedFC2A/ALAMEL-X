// validate-word-pack.mjs — QA script for word bank integrity
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filePath = resolve(process.cwd(), 'public', 'data', 'word-pack.json');
const raw = readFileSync(filePath, 'utf-8');
const pack = JSON.parse(raw);
const words = pack.words;

let errors = 0;

// ─── 1. Duplicate IDs ───
const idSet = new Set();
const dupeIds = [];
for (const w of words) {
    if (idSet.has(w.id)) {
        dupeIds.push(w.id);
    }
    idSet.add(w.id);
}
if (dupeIds.length > 0) {
    console.error(`❌ Duplicate IDs: ${dupeIds.join(', ')}`);
    errors += dupeIds.length;
} else {
    console.log('✅ No duplicate IDs.');
}

// ─── 2. Duplicate words (after normalize) ───
function normalizeWord(text) {
    return text.toLowerCase().replace(/[\u064B-\u065F\u0610-\u061A]/g, '').trim();
}
const wordSet = new Set();
const dupeWords = [];
for (const w of words) {
    const key = normalizeWord(w.text_ar) + '||' + normalizeWord(w.text_en);
    if (wordSet.has(key)) {
        dupeWords.push(`${w.id}: ${w.text_ar} / ${w.text_en}`);
    }
    wordSet.add(key);
}
if (dupeWords.length > 0) {
    console.warn(`⚠️  Duplicate words (${dupeWords.length}): ${dupeWords.slice(0, 10).join('; ')}...`);
} else {
    console.log('✅ No duplicate words.');
}

// ─── 3. Missing hints/decoys/category/difficulty ───
const validDifficulties = new Set(['easy', 'medium', 'hard']);
let missingFields = 0;
for (const w of words) {
    if (!w.hints || w.hints.length === 0) {
        console.warn(`⚠️  ${w.id} has no hints`);
        missingFields++;
    }
    if (!w.decoys || w.decoys.length < 3) {
        console.warn(`⚠️  ${w.id} has fewer than 3 decoys (${w.decoys?.length ?? 0})`);
        missingFields++;
    }
    if (!w.category) {
        console.error(`❌ ${w.id} has no category`);
        errors++;
    }
    if (!validDifficulties.has(w.difficulty)) {
        console.error(`❌ ${w.id} has invalid difficulty: ${w.difficulty}`);
        errors++;
    }
}
if (missingFields === 0) {
    console.log('✅ All entries have hints, decoys, category, and valid difficulty.');
}

// ─── 4. Category distribution ───
console.log('\n📊 Category Distribution:');
const catCount = {};
for (const w of words) {
    catCount[w.category] = (catCount[w.category] || 0) + 1;
}
const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sorted) {
    const bar = '█'.repeat(Math.round(count / 3));
    console.log(`  ${cat.padEnd(12)} ${String(count).padStart(4)}  ${bar}`);
}

// ─── 5. Difficulty distribution ───
console.log('\n📊 Difficulty Distribution:');
const diffCount = {};
for (const w of words) {
    diffCount[w.difficulty] = (diffCount[w.difficulty] || 0) + 1;
}
for (const [diff, count] of Object.entries(diffCount)) {
    const pct = ((count / words.length) * 100).toFixed(1);
    console.log(`  ${diff.padEnd(8)} ${String(count).padStart(4)} (${pct}%)`);
}

// ─── Summary ───
console.log(`\n📦 Total words: ${words.length}`);
console.log(`📦 Version: ${pack.version}`);
if (errors > 0) {
    console.error(`\n❌ ${errors} error(s) found.`);
    process.exit(1);
} else {
    console.log('\n✅ Word pack validation passed.');
}
