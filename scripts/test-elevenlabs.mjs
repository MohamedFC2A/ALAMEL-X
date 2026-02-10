#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function stripQuoted(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = stripQuoted(trimmed.slice(separator + 1));
    if (!key || process.env[key]) {
      continue;
    }
    process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const API_KEY = process.env.ELEVENLABS_API_KEY || '';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const VOICE_NAME = process.env.ELEVENLABS_VOICE_NAME || '';
const MODEL_ID = process.env.ELEVENLABS_TTS_MODEL_ID || 'eleven_multilingual_v2';

const VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
const TTS_URL_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function scoreVoice(voice, preferredNameLower) {
  const name = String(voice?.name || '').toLowerCase();
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {};
  const language = String(labels.language || labels.locale || labels.accent || '').toLowerCase();
  let score = 0;
  if (preferredNameLower && name.includes(preferredNameLower)) score += 60;
  if (/(arabic|ar|egypt|egyptian|masr|misr)/.test(language)) score += 50;
  if (/(arabic|egypt|egyptian|masr|misr)/.test(name)) score += 24;
  if (voice?.category === 'premade') score += 8;
  if (voice?.deleted || voice?.status === 'deleted') score -= 120;
  return score;
}

async function listVoices() {
  const response = await fetch(VOICES_URL, {
    method: 'GET',
    headers: {
      'xi-api-key': API_KEY,
      accept: 'application/json',
    },
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.detail?.message || payload?.error?.message || `Voices API failed (${response.status}).`;
    fail(message);
  }

  return Array.isArray(payload?.voices) ? payload.voices : [];
}

async function main() {
  if (!API_KEY) {
    fail('ELEVENLABS_API_KEY is missing in environment (.env.local/.env or shell).');
  }

  const voices = await listVoices();
  if (!voices.length) {
    fail('No voices returned from ElevenLabs account.');
  }

  let selected = null;
  if (VOICE_ID) {
    selected = voices.find((voice) => String(voice?.voice_id || '') === VOICE_ID) || null;
    if (!selected) {
      console.warn(`WARN: configured ELEVENLABS_VOICE_ID not found (${VOICE_ID}). Falling back to auto voice.`);
    }
  }

  if (!selected) {
    const preferredNameLower = VOICE_NAME.trim().toLowerCase();
    const ranked = [...voices]
      .filter((voice) => !voice?.deleted && voice?.status !== 'deleted')
      .sort((a, b) => scoreVoice(b, preferredNameLower) - scoreVoice(a, preferredNameLower));
    selected = ranked[0] || voices[0];
  }

  const selectedId = String(selected?.voice_id || '').trim();
  if (!selectedId) {
    fail('Could not resolve a valid voice_id.');
  }

  const payload = {
    text: 'اختبار صوت من ElevenLabs. لو بتسمعني يبقى التكامل شغال.',
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.46,
      similarity_boost: 0.74,
      style: 0.34,
      use_speaker_boost: true,
    },
  };

  const ttsResponse = await fetch(`${TTS_URL_BASE}/${encodeURIComponent(selectedId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      accept: 'audio/mpeg',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!ttsResponse.ok) {
    const raw = await ttsResponse.text();
    fail(`TTS failed (${ttsResponse.status}): ${raw.slice(0, 240)}`);
  }

  const buffer = Buffer.from(await ttsResponse.arrayBuffer());
  if (!buffer.length) {
    fail('TTS response is empty.');
  }

  const outDir = path.join(process.cwd(), 'output', 'elevenlabs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'tts-test.mp3');
  fs.writeFileSync(outFile, buffer);

  console.log(`PASS: ElevenLabs TTS is working.`);
  console.log(`Selected voice: ${selected?.name || 'unknown'} (${selectedId})`);
  console.log(`Saved: ${outFile}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
