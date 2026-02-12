# Agent X (العميل x)

## Overview
An Arabic-language social deduction web game built with React, TypeScript, and Vite. Players try to identify a spy among them. The app is a PWA (Progressive Web App) with offline support.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 7
- **Styling**: CSS (custom, no framework)
- **State**: Dexie (IndexedDB wrapper) for local data persistence
- **i18n**: i18next for Arabic localization
- **UI**: Framer Motion (animations), Lucide React (icons)
- **PWA**: vite-plugin-pwa with Workbox
- **Testing**: Vitest, Testing Library, Playwright

## Project Structure
- `src/` - Application source code (React components, screens, hooks, data, styles)
- `public/` - Static assets (avatars SVGs, fonts, word pack data)
- `api/` - Serverless API functions (DeepSeek chat, ElevenLabs TTS/STT)
- `scripts/` - Utility scripts (word generation, testing)
- `output/` - Design/UI reference files

## Development
- **Dev server**: `npm run dev` (Vite on port 5000)
- **Build**: `npm run build` (TypeScript check + Vite build, outputs to `dist/`)
- **Test**: `npm run test`

## Deployment
- Static deployment serving the `dist/` directory after build

## Recent Changes
- 2026-02-12: AI vote-only mode with microphone listening - useAiVoteListener hook captures Arabic speech during discussion, saves transcripts, AI uses them for smarter voting via decideVoteFromTranscripts()
- 2026-02-12: Strong AI hint mode - DeepSeek-powered contextual hints for spy players, generates English+Arabic hints without revealing the secret word
- 2026-02-12: DeepSeek API proxy - Vite middleware plugin at /api/deepseek/chat proxies requests to DeepSeek API using DEEPSEEK_API_KEY secret
- 2026-02-12: Cinematic splash screen - animated glowing "X" logo, floating particles, progress bar, ~2.5s duration, fades to main app
- 2026-02-12: Enhanced reveal vibration - dramatic haptic patterns [40,30,60,40,80,50,100], vibrateRevealComplete() function
- 2026-02-12: Improved progress bar - gradient fill, pulsing glow effect, tech grid styling
- 2026-02-12: Settings redesign - Lucide React icons for all section headings (Gamepad2, Palette, Volume2, Bot, Wrench), new settings.css
- 2026-02-12: Expanded word pack to 1002 words (was 504) - 19 categories, per-cluster hints, 7 new Egyptian categories (أفلام ومسلسلات, شارع مصري, أمثال وكلام, ألعاب أطفال, أغاني ومزيكا, سفر وسياحة, صحة وجسم)
- 2026-02-12: Moved restart game button to home screen - shows only when active match exists, CTA changes to "كمّل المهمة" during active match
- 2026-02-12: 5-tier fire system on level badge - ember (Lv5), flame (Lv10), inferno (Lv20), mythic (Lv35), legendary (Lv50+) with progressive CSS animations
- 2026-02-12: PlayerNameplate shows top 3 medals only (was 5)
- 2026-02-12: SVG medal icons with unique gradient IDs (useId), tier letters (B/S/G/M), icon+label chips with gradient backgrounds and hover effects
- 2026-02-12: Smarter XP system - base 15 XP/round + bonuses (win 10, spy 5, guess 20, capture 8, duo 5, streak 3/count), streaks only reset when playing that role
- 2026-02-12: Winner messages show spy names (الجاسوس محمد كسب! / الجواسيس محمد واحمد انتصروا!), guessing now mandatory
- 2026-02-12: Spy-themed result UI - result-winner-banner with shimmer, guess-countdown with pulse, stage pills with HUD styling
- 2026-02-12: Smarter Auto UI system - continuous scale calculation, auto animation speed based on device, better breakpoints
- 2026-02-12: Enhanced grid background - dual-layer animation (48px + 192px), smooth drift/pulse, reduced-motion support
- 2026-02-12: Improved reveal mask - gradual haptic vibration on mobile, CSS pulse/scanline/shake animations
- 2026-02-12: Redesigned all 9 player SVG avatars - detailed spy theme with gradients, tactical gear, distinct characters
- 2026-02-12: Smarter medal system - excluded AI bots, added 6 new medal rules (perfect_round, spy_master, iron_streak, veteran_spy, guardian_angel, loss_recovery)
- 2026-02-12: Fixed guessing comparison - removed double-formatting, aligned normalization for Arabic/English word matching
- 2026-02-12: Fixed spy count selection UX - clearer toggle, hover states, validation warnings
- 2026-02-12: UI visual redesign - refined color palette (blue-tinted dark backgrounds), teal CTA buttons, improved typography for Arabic, better spacing/radius, enhanced card/surface depth
- 2026-02-12: Initial Replit setup - configured Vite for port 5000 with host 0.0.0.0 and allowedHosts
