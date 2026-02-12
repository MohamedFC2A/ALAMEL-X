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
