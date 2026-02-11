import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { db, defaultSettings, ensureSettings } from './lib/db';
import { applyDocumentLanguage } from './lib/i18n';
import { installClockDebugHooks } from './lib/clock';
import { updateGlobalSettings } from './lib/game-repository';
import {
  analyzeUiHealth,
  buildUiSelfHealPersistedPatch,
  collectUiDiagnosticsContext,
  shouldPersistUiSelfHeal,
} from './lib/ui-self-heal';
import { serializeUiDiagnosticsSnapshot } from './lib/ui-debugger';
import { installGlobalUiFeedback, playUiFeedback, syncUiFeedbackSettings } from './lib/ui-feedback';
import { LoadingProvider, useLoading } from './components/loading-controller';
import { LoadingOverlay } from './components/LoadingOverlay';
import type { GlobalSettings } from './types';
import './index.css';

const PlayersScreen = lazy(async () => ({ default: (await import('./screens/PlayersScreen')).PlayersScreen }));
const SettingsScreen = lazy(async () => ({ default: (await import('./screens/SettingsScreen')).SettingsScreen }));
const PlaySetupScreen = lazy(async () => ({ default: (await import('./screens/PlaySetupScreen')).PlaySetupScreen }));
const RevealScreen = lazy(async () => ({ default: (await import('./screens/RevealScreen')).RevealScreen }));
const DiscussionScreen = lazy(async () => ({ default: (await import('./screens/DiscussionScreen')).DiscussionScreen }));
const ResolutionScreen = lazy(async () => ({ default: (await import('./screens/ResolutionScreen')).ResolutionScreen }));
const SummaryScreen = lazy(async () => ({ default: (await import('./screens/SummaryScreen')).SummaryScreen }));

const AUTO_HEAL_RESIZE_DEBOUNCE_MS = 260;
const AUTO_HEAL_DEDUPE_WINDOW_MS = 4500;

function generateNoise(opacity = 0.04): string {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return '';
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return '';
  }
  if (!ctx) return '';

  const imageData = ctx.createImageData(64, 64);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < 0.5) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.floor(255 * opacity);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

function ThemeController({ settings }: { settings: GlobalSettings | undefined }) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const activeMatch = useLiveQuery(() => db.activeMatch.get('active'), []);
  const resizeHealTimerRef = useRef<number | null>(null);
  const autoHealBusyRef = useRef(false);
  const lastAutoHealSignatureRef = useRef('');
  const lastAutoHealAtRef = useRef(0);
  const routeAudioRef = useRef(location.pathname);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const root = document.documentElement;
    root.style.setProperty('--ui-scale', settings.uiScale.toString());
    root.style.setProperty('--anim-speed', settings.reducedMotionMode ? '0' : settings.animationSpeed.toString());
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-contrast', settings.contrastPreset);
    root.setAttribute('data-density', settings.uiDensity);
    root.setAttribute('data-motion', settings.reducedMotionMode ? 'reduced' : 'full');
    syncUiFeedbackSettings(settings);

    const changeLanguage = (i18n as { changeLanguage?: (next: string) => Promise<unknown> | unknown }).changeLanguage;
    if (typeof changeLanguage === 'function' && i18n.language !== settings.language) {
      void changeLanguage.call(i18n, settings.language);
    }

    applyDocumentLanguage(settings.language);
  }, [i18n, settings]);

  useEffect(() => {
    if (routeAudioRef.current === location.pathname) {
      return;
    }
    routeAudioRef.current = location.pathname;
    playUiFeedback('navigation', 0.92);
  }, [location.pathname]);

  useEffect(() => {
    const root = document.documentElement;

    const applyAppHeight = () => {
      const nextHeight = Math.max(480, Math.round(window.visualViewport?.height ?? window.innerHeight));
      root.style.setProperty('--app-height', `${nextHeight}px`);
    };

    applyAppHeight();
    window.addEventListener('resize', applyAppHeight, { passive: true });
    window.visualViewport?.addEventListener('resize', applyAppHeight);
    return () => {
      window.removeEventListener('resize', applyAppHeight);
      window.visualViewport?.removeEventListener('resize', applyAppHeight);
    };
  }, []);

  useEffect(() => {
    if (!settings?.uiAutoFixEnabled) {
      return;
    }

    const runAutoHeal = async () => {
      if (autoHealBusyRef.current) {
        return;
      }
      autoHealBusyRef.current = true;
      try {
        const now = Date.now();
        const context = collectUiDiagnosticsContext();
        const result = analyzeUiHealth(settings, context);
        if (!shouldPersistUiSelfHeal(settings, result, { mode: 'auto' })) {
          return;
        }

        const signature = JSON.stringify({
          patch: result.patch,
          score: result.report.score,
        });
        if (
          signature === lastAutoHealSignatureRef.current &&
          now - lastAutoHealAtRef.current < AUTO_HEAL_DEDUPE_WINDOW_MS
        ) {
          return;
        }

        await updateGlobalSettings(buildUiSelfHealPersistedPatch(result));
        lastAutoHealSignatureRef.current = signature;
        lastAutoHealAtRef.current = now;
      } finally {
        autoHealBusyRef.current = false;
      }
    };

    const scheduleAutoHeal = () => {
      if (resizeHealTimerRef.current !== null) {
        window.clearTimeout(resizeHealTimerRef.current);
      }
      resizeHealTimerRef.current = window.setTimeout(() => {
        void runAutoHeal();
      }, AUTO_HEAL_RESIZE_DEBOUNCE_MS);
    };

    scheduleAutoHeal();
    window.addEventListener('resize', scheduleAutoHeal, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleAutoHeal);

    return () => {
      window.removeEventListener('resize', scheduleAutoHeal);
      window.visualViewport?.removeEventListener('resize', scheduleAutoHeal);
      if (resizeHealTimerRef.current !== null) {
        window.clearTimeout(resizeHealTimerRef.current);
        resizeHealTimerRef.current = null;
      }
    };
  }, [
    settings,
    settings?.uiAutoFixEnabled,
    settings?.uiScale,
    settings?.uiDensity,
    settings?.animationSpeed,
    settings?.reducedMotionMode,
    settings?.uiSelfHealScore,
  ]);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        screen: location.pathname,
        lang: i18n.language,
        activeMatchStatus: activeMatch?.match.status ?? 'none',
        revealPhase: activeMatch?.revealState.phase ?? null,
        revealIndex: activeMatch?.revealState.currentRevealIndex ?? null,
        uiPhaseLabel: activeMatch?.uiPhaseLabel ?? null,
        spies: activeMatch?.match.spyIds.length ?? 0,
      });
  }, [activeMatch, i18n.language, location.pathname]);

  useEffect(() => {
    window.get_ui_debug_snapshot = () => serializeUiDiagnosticsSnapshot(settings ?? defaultSettings);
  }, [settings]);

  return null;
}

function GlobalLoadingOverlay() {
  const { state } = useLoading();
  if (!state) return null;
  return (
    <LoadingOverlay
      intent={state.intent}
      message={state.message}
      blocking={state.blocking}
      visible={state.visible}
    />
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const reducedMotion = Boolean(settings?.reducedMotionMode);
  const speed = Math.max(0.35, settings?.animationSpeed ?? 1);
  const yOffset = reducedMotion ? 0 : 16;
  const duration = reducedMotion ? 0.01 : 0.22 / speed;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="route-stage"
        initial={{ opacity: 0, y: yOffset }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -yOffset, pointerEvents: 'none' }}
        transition={{ duration }}
      >
        <Suspense fallback={null}>
          <Routes location={location}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/players" element={<PlayersScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/play/setup" element={<PlaySetupScreen />} />
            <Route path="/play/reveal" element={<RevealScreen />} />
            <Route path="/play/discussion" element={<DiscussionScreen />} />
            <Route path="/play/resolution" element={<ResolutionScreen />} />
            <Route path="/play/summary" element={<SummaryScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const settings = useLiveQuery(() => db.settings.get('global'), []);
  const noiseTexture = useMemo(() => generateNoise(0.03), []);

  useEffect(() => {
    void ensureSettings();
    installClockDebugHooks();
    const uninstallUiFeedback = installGlobalUiFeedback();
    return () => {
      uninstallUiFeedback();
    };
  }, []);

  return (
    <BrowserRouter>
      <LoadingProvider>
        <div className="app-shell">
          <div className="app-shell__grid" aria-hidden="true" />
          <div className="app-shell__vignette" />
          <div className="app-shell__noise" style={{ backgroundImage: noiseTexture }} />
          <div className="app-shell__content">
            <ThemeController settings={settings} />
            <AnimatedRoutes />
          </div>
        </div>
        <GlobalLoadingOverlay />
      </LoadingProvider>
    </BrowserRouter>
  );
}

export default App;

declare global {
  interface Window {
    render_game_to_text: () => string;
    get_ui_debug_snapshot: () => string;
  }
}
