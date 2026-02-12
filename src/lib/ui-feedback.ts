import type { GlobalSettings } from '../types';

export type UiFeedbackTone =
  | 'tap'
  | 'toggle'
  | 'confirm'
  | 'danger'
  | 'navigation'
  | 'slider'
  | 'reveal-start'
  | 'reveal-tick'
  | 'reveal-done'
  | 'reveal-cancel';

type WaveType = OscillatorType;

interface ToneFrame {
  frequency: number;
  durationMs: number;
  gain: number;
  type?: WaveType;
}

interface FeedbackConfig {
  soundEnabled: boolean;
  reducedMotionMode: boolean;
}

const DEFAULT_CONFIG: FeedbackConfig = {
  soundEnabled: true,
  reducedMotionMode: false,
};

const TONE_PATTERNS: Record<UiFeedbackTone, ToneFrame[]> = {
  tap: [
    { frequency: 620, durationMs: 28, gain: 0.024, type: 'triangle' },
    { frequency: 760, durationMs: 26, gain: 0.018, type: 'sine' },
  ],
  toggle: [
    { frequency: 420, durationMs: 30, gain: 0.022, type: 'triangle' },
    { frequency: 560, durationMs: 32, gain: 0.019, type: 'triangle' },
  ],
  confirm: [
    { frequency: 540, durationMs: 44, gain: 0.024, type: 'triangle' },
    { frequency: 720, durationMs: 48, gain: 0.024, type: 'triangle' },
    { frequency: 960, durationMs: 46, gain: 0.02, type: 'sine' },
  ],
  danger: [
    { frequency: 300, durationMs: 42, gain: 0.024, type: 'sawtooth' },
    { frequency: 190, durationMs: 65, gain: 0.02, type: 'sawtooth' },
  ],
  navigation: [
    { frequency: 450, durationMs: 30, gain: 0.018, type: 'triangle' },
    { frequency: 610, durationMs: 34, gain: 0.017, type: 'triangle' },
  ],
  slider: [{ frequency: 880, durationMs: 16, gain: 0.014, type: 'sine' }],
  'reveal-start': [
    { frequency: 280, durationMs: 44, gain: 0.021, type: 'sine' },
    { frequency: 420, durationMs: 36, gain: 0.018, type: 'triangle' },
    { frequency: 540, durationMs: 26, gain: 0.015, type: 'triangle' },
  ],
  'reveal-tick': [
    { frequency: 780, durationMs: 12, gain: 0.011, type: 'triangle' },
    { frequency: 980, durationMs: 10, gain: 0.01, type: 'sine' },
  ],
  'reveal-done': [
    { frequency: 620, durationMs: 28, gain: 0.026, type: 'triangle' },
    { frequency: 860, durationMs: 36, gain: 0.024, type: 'triangle' },
    { frequency: 1180, durationMs: 42, gain: 0.022, type: 'triangle' },
    { frequency: 1540, durationMs: 56, gain: 0.019, type: 'sine' },
  ],
  'reveal-cancel': [
    { frequency: 360, durationMs: 28, gain: 0.018, type: 'triangle' },
    { frequency: 280, durationMs: 34, gain: 0.014, type: 'sawtooth' },
  ],
};

const MIN_TONE_GAP_MS: Record<UiFeedbackTone, number> = {
  tap: 45,
  toggle: 55,
  confirm: 80,
  danger: 120,
  navigation: 75,
  slider: 40,
  'reveal-start': 120,
  'reveal-tick': 30,
  'reveal-done': 140,
  'reveal-cancel': 90,
};

const state = {
  config: DEFAULT_CONFIG,
  audio: null as AudioContext | null,
  installed: false,
  lastToneAt: new Map<UiFeedbackTone, number>(),
  lastSliderSoundAt: 0,
  revealBucket: -1,
  lastRevealHapticAt: 0,
  lastGradualVibrateAt: 0,
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

function canUseAudioApi() {
  if (typeof window === 'undefined') {
    return false;
  }
  const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  return Boolean(window.AudioContext) || Boolean(extendedWindow.webkitAudioContext);
}

function canUseHaptics() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function getAudioContext(): AudioContext | null {
  if (!canUseAudioApi()) {
    return null;
  }

  if (!state.audio) {
    const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext || extendedWindow.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    state.audio = new Ctor();
  }

  if (state.audio.state === 'suspended') {
    void state.audio.resume();
  }

  return state.audio;
}

function shouldThrottleTone(tone: UiFeedbackTone) {
  const now = Date.now();
  const last = state.lastToneAt.get(tone) ?? 0;
  const minGap = MIN_TONE_GAP_MS[tone] ?? 45;
  if (now - last < minGap) {
    return true;
  }
  state.lastToneAt.set(tone, now);
  return false;
}

function playToneSequence(frames: ToneFrame[], intensity = 1) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  let cursor = context.currentTime + 0.002;
  const scale = Math.max(0.55, Math.min(1.55, intensity));

  for (const frame of frames) {
    const durationSec = Math.max(0.01, frame.durationMs / 1000);
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = frame.type ?? 'triangle';
    oscillator.frequency.setValueAtTime(frame.frequency * scale, cursor);

    const peak = Math.min(0.08, frame.gain * scale);
    gainNode.gain.setValueAtTime(0.0001, cursor);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), cursor + Math.min(0.016, durationSec * 0.35));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + durationSec);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + durationSec + 0.008);
    cursor += durationSec + 0.012;
  }
}

export function syncUiFeedbackSettings(settings?: Pick<GlobalSettings, 'soundEnabled' | 'reducedMotionMode'>): void {
  state.config = {
    soundEnabled: settings?.soundEnabled ?? true,
    reducedMotionMode: settings?.reducedMotionMode ?? false,
  };
}

export function playUiFeedback(tone: UiFeedbackTone, intensity = 1): void {
  if (!state.config.soundEnabled) {
    return;
  }
  if (shouldThrottleTone(tone)) {
    return;
  }
  const pattern = TONE_PATTERNS[tone];
  if (!pattern?.length) {
    return;
  }
  playToneSequence(pattern, intensity);
}

function vibratePulse(durationMs: number) {
  if (!canUseHaptics()) {
    return;
  }
  navigator.vibrate(Math.max(0, Math.round(durationMs)));
}

export function vibrateTap(strength: 'soft' | 'normal' | 'strong' = 'normal'): void {
  if (!canUseHaptics()) {
    return;
  }

  const multiplier = state.config.reducedMotionMode ? 0.55 : 1;
  const duration = strength === 'soft' ? 8 : strength === 'strong' ? 22 : 14;
  vibratePulse(duration * multiplier);
}

export function beginRevealHoldFeedback(): void {
  state.revealBucket = -1;
  state.lastRevealHapticAt = 0;
  state.lastGradualVibrateAt = 0;
  playUiFeedback('reveal-start');
  if (canUseHaptics() && !prefersReducedMotion()) {
    navigator.vibrate(15);
  }
  if (canUseHaptics() && isCoarsePointerDevice() && !state.config.reducedMotionMode) {
    navigator.vibrate([14, 18, 18]);
    return;
  }
  vibrateTap('normal');
}

export function updateRevealHoldFeedback(progress: number): void {
  const normalized = Math.max(0, Math.min(1, progress));
  const bucket = Math.floor(normalized * 24);
  if (bucket <= state.revealBucket) {
    return;
  }
  state.revealBucket = bucket;

  playUiFeedback('reveal-tick', 0.72 + normalized * 0.9);

  if (canUseHaptics() && !prefersReducedMotion()) {
    const now = Date.now();
    if (now - state.lastGradualVibrateAt >= 150) {
      state.lastGradualVibrateAt = now;
      navigator.vibrate(Math.round(8 + normalized * 25));
    }
  }

  if (canUseHaptics()) {
    const coarsePointer = isCoarsePointerDevice();
    const now = Date.now();
    const minGap = state.config.reducedMotionMode ? 90 : coarsePointer ? 52 : 66;
    if (now - state.lastRevealHapticAt < minGap && normalized < 0.92) {
      return;
    }
    state.lastRevealHapticAt = now;

    const motionMultiplier = state.config.reducedMotionMode ? 0.62 : coarsePointer ? 1.1 : 1;
    const eased = normalized ** 1.45;
    const basePulse = Math.round((8 + eased * 24) * motionMultiplier);
    const pulseA = Math.max(6, Math.min(38, basePulse));
    const pulseB = Math.max(7, Math.min(44, pulseA + Math.round(2 + normalized * 9)));
    const pulseC = Math.max(8, Math.min(48, pulseB + Math.round(2 + normalized * 7)));
    const pulseD = Math.max(9, Math.min(54, pulseC + 5));
    const gap = Math.max(7, Math.round((22 - normalized * 12) * motionMultiplier));

    if (normalized < 0.28) {
      vibratePulse(pulseA);
    } else if (normalized < 0.68) {
      navigator.vibrate([pulseA, gap, pulseB]);
    } else if (normalized < 0.9) {
      navigator.vibrate([pulseA, gap, pulseB, Math.max(6, gap - 2), pulseC]);
    } else {
      navigator.vibrate([pulseA, gap, pulseB, Math.max(6, gap - 2), pulseC, Math.max(5, gap - 3), pulseD]);
    }
  }
}

export function vibrateRevealComplete(): void {
  if (!canUseHaptics()) {
    return;
  }
  if (prefersReducedMotion() || state.config.reducedMotionMode) {
    navigator.vibrate([20, 20, 30, 20, 40]);
    return;
  }
  navigator.vibrate([40, 30, 60, 40, 80, 50, 100]);
}

export function completeRevealHoldFeedback(): void {
  playUiFeedback('reveal-done', 1.05);
  vibrateRevealComplete();
  if (canUseHaptics() && !prefersReducedMotion()) {
    setTimeout(() => {
      if (canUseHaptics()) {
        navigator.vibrate([40, 30, 60, 40, 80, 50, 100]);
      }
    }, 420);
  }
  state.revealBucket = -1;
  state.lastRevealHapticAt = 0;
  state.lastGradualVibrateAt = 0;
}

export function cancelRevealHoldFeedback(): void {
  playUiFeedback('reveal-cancel', 0.95);
  if (canUseHaptics()) {
    navigator.vibrate(0);
  }
  state.revealBucket = -1;
  state.lastRevealHapticAt = 0;
  state.lastGradualVibrateAt = 0;
}

function toneFromElement(element: Element): UiFeedbackTone {
  if (element.closest('.game-button--cta, .next-btn, #start-mission-btn, .update-check-btn')) {
    return 'confirm';
  }
  if (element.closest('.pill-btn, input[type="checkbox"], input[type="radio"], select')) {
    return 'toggle';
  }
  if (element.closest('.header-home-link, a')) {
    return 'navigation';
  }
  if (element.closest('.choice-card')) {
    return 'confirm';
  }
  if (element.closest('.game-button--danger')) {
    return 'danger';
  }
  return 'tap';
}

export function installGlobalUiFeedback(): () => void {
  if (state.installed || typeof document === 'undefined') {
    return () => undefined;
  }

  state.installed = true;

  const onPointerDown = (event: Event) => {
    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    const interactive = target.closest(
      'button, a, [role="button"], .pill-btn, .pick-card, .choice-card, .ghost-link',
    );
    if (!interactive) {
      return;
    }
    if ((interactive as HTMLElement).dataset.sfx === 'off') {
      return;
    }

    const tone = toneFromElement(interactive);
    playUiFeedback(tone);
    if (tone === 'confirm' || tone === 'danger') {
      vibrateTap('normal');
    } else {
      vibrateTap('soft');
    }
  };

  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.type !== 'range') {
      return;
    }
    const now = Date.now();
    if (now - state.lastSliderSoundAt < 48) {
      return;
    }
    state.lastSliderSoundAt = now;
    playUiFeedback('slider', 0.75);
    if (!state.config.reducedMotionMode) {
      vibrateTap('soft');
    }
  };

  const onChange = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const isChoice =
      target.matches('select, input[type="checkbox"], input[type="radio"]') ||
      Boolean(target.closest('select, input[type="checkbox"], input[type="radio"], .pill-btn'));
    if (!isChoice) {
      return;
    }
    playUiFeedback('toggle');
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onChange, true);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('input', onInput, true);
    document.removeEventListener('change', onChange, true);
    state.installed = false;
  };
}
