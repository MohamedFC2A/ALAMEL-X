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
- 2026-02-12: Initial Replit setup - configured Vite for port 5000 with host 0.0.0.0 and allowedHosts
