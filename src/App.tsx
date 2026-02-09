import { useEffect } from 'react';
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

    const targetLanguage = 'ar' as const;
    if (settings.language !== 'ar' || settings.pendingLanguage) {
      void db.settings.put({
        ...settings,
        language: 'ar',
        pendingLanguage: undefined,
      });
    }

    if (i18n.language !== targetLanguage) {
      void i18n.changeLanguage(targetLanguage);
    }

    applyDocumentLanguage(targetLanguage);
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

  useEffect(() => {
    void ensureSettings();
    installClockDebugHooks();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <ThemeController settings={settings} />
        <AnimatedRoutes />
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
