import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { PlayersScreen } from './screens/PlayersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PlaySetupScreen } from './screens/PlaySetupScreen';
import { RevealScreen } from './screens/RevealScreen';
import { DiscussionScreen } from './screens/DiscussionScreen';
import { ResolutionScreen } from './screens/ResolutionScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { db, ensureSettings } from './lib/db';
import { applyDocumentLanguage } from './lib/i18n';
import { installClockDebugHooks } from './lib/clock';
import type { GlobalSettings } from './types';
import './index.css';

function generateNoise(opacity = 0.04): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imageData = ctx.createImageData(64, 64);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < 0.5) {
      data[i] = 0;     // R
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
      data[i + 3] = Math.floor(255 * opacity); // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

function ThemeController({ settings }: { settings: GlobalSettings | undefined }) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const activeMatch = useLiveQuery(() => db.activeMatch.get('active'), []);

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

    if (i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }

    applyDocumentLanguage(settings.language);
  }, [activeMatch, i18n, settings]);

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

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="route-stage"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.22 }}
      >
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
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="app-shell__grid" aria-hidden="true" />
        <div className="app-shell__vignette" />
        <div className="app-shell__noise" style={{ backgroundImage: noiseTexture }} />
        <div className="app-shell__content">
          <ThemeController settings={settings} />
          <AnimatedRoutes />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;

declare global {
  interface Window {
    render_game_to_text: () => string;
  }
}
