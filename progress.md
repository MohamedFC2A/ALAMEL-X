Original prompt: PLEASE IMPLEMENT THIS PLAN: SUSAWI v1 premium pass-and-play social deduction PWA with React+Vite, offline-first local persistence, EN/AR, players/records, global settings, reveal-discussion-resolution flow, and 20k+ non-repeating categorized words.

## Progress Log
- Initialized Vite React TypeScript app.
- Installed core dependencies: dexie, react-router-dom, i18next, react-i18next, framer-motion, vite-plugin-pwa.
- Installed testing stack: vitest, jsdom, testing-library.
- Activated develop-web-game skill workflow.

## TODO (Current)
- Build data model and IndexedDB schema.
- Generate bundled 20k+ word pack.
- Implement all v1 screens and game flow.
- Configure PWA + i18n + RTL.
- Add tests for core logic.
- Run Playwright skill client and review artifacts.
## Progress Log
- Implemented architecture from scratch with React Router flow and module split.
- Added Dexie schema for players, settings, word usage, active match, match records, AI teaser opt-in.
- Added i18n (EN/AR), RTL handling, theme + UI scale + animation speed application.
- Built screens: Home, Players/Records, Settings, Play Setup, Reveal, Discussion, Resolution, Summary.
- Implemented reveal back-safety, discussion timer, spy guess timer, winner logic, and stats/history updates.
- Added generated bundled word pack (`public/data/word-pack.json`) with 21,000 entries and non-repeat lock flow.
- Added PWA config and registration.
- Added core unit tests for spy assignment, winner matrix, guess validation, and word selection behavior.

## TODO (Current)
- Fix any lint/type issues from full compile.
- Run skill-required Playwright client loop and inspect screenshots/state/errors.
- Final polish for edge-case handling discovered during runtime test.
## Final Validation
- Ran `npm run lint`: pass.
- Ran `npm run test`: pass (9 tests).
- Ran `npm run build`: pass (PWA artifacts generated).
- Ran develop-web-game Playwright client against home/settings/players/play/AI teaser flows.
- Reviewed screenshots and render_game_to_text outputs.
- Fixed runtime Dexie schema issue discovered by Playwright (`SchemaError: DexieError2`) by simplifying nested index definitions and adding DB v2 migration.

## Remaining TODOs / Suggestions
- Add lazy-loading/manual chunk split for word engine + data to reduce main bundle size warning (>500kb).
- Add integration tests for full round progression (setup -> reveal -> discussion -> resolution -> summary).
- Add richer Arabic word payloads (currently generated placeholder Arabic labels for many entries).
- Add optional seedable RNG for deterministic QA replays.
## Progress Log
- Implemented Cinematic Tension UI system with new design tokens and rebuilt global CSS.
- Added reusable UX components: ScreenScaffold, StatusBanner, PrimaryActionBar, PhaseIndicator.
- Extended settings model with reduced motion, contrast preset, and UI density.
- Added Dexie schema v3 migration to preserve backward compatibility.
- Redesigned Home, Players, Settings, Play Setup, Reveal, Discussion, Resolution, and Summary screens to align with phased UX clarity.
- Added phase indicators and stronger action hierarchy across gameplay flow.
## Validation Update (UI/UX Cinematic)
- Ran lint/test/build after full redesign: all pass.
- Playwright visual checks completed for Home, Players, Settings, Play redirect, and AI teaser modal.
- Reviewed screenshots and text-state outputs (`render_game_to_text`) and verified no runtime errors in covered flows.
- Confirmed redirect message quality and hierarchy improvements in Players screen.

## Pending Enhancements (Optional)
- Add dedicated integration test for the new phase indicator presence across setup/reveal/discussion/resolution/summary.
- Add visual regression snapshots (golden screenshots) to catch UI drift in future edits.

## Progress Log
- Reworked the full visual language to a unified spy-mission style across all screens (dossier-like cards, tactical badges, stronger phase/UI hierarchy).
- Updated `ScreenScaffold` header structure with a persistent case badge to unify page identity.
- Applied gameplay-first styling to home, setup, players, reveal, discussion, resolution, settings, and summary through shared class tuning in `src/index.css`.
- Tightened responsive behavior for small phones by reducing spacing, card padding, button heights, and header density.

## TODO (Current)
- Run Playwright skill client and inspect latest screenshots/state snapshots for visual regressions after the full theme update.

## Progress Log
- Fixed spy guess option generation to always include the citizens' correct word, even after shuffle/truncation.
- Added unit coverage for guess-options correctness (always includes correct option, no duplicates, stable length at 5 when pool allows).
- Reworked reveal hold interaction into a robust state machine (`idle -> holding -> revealed`) with pointer capture and progress-based tolerance.
- Added local unlock timer after reveal (timeout-backed) so `Next` activation is reliable and no longer depends only on clock polling.
- Added adaptive reveal delay calculation based on hint length, teammate presence, and accessibility extra-read configuration with safe clamp limits.
- Improved reveal card information hierarchy for spy role (category pill + hint box + cleaner teammate note).
- Applied no-copy/no-select behavior to gameplay screen containers while preserving text selection/editing inside inputs, textareas, selects, and contenteditable controls.
- Added integration-style UI test for reveal hold flow: early release fails, near-threshold release succeeds, reveal remains open, and Next unlocks after smart delay.
- Restored lint-clean state after changes (`npm run lint`).

## Validation Update (Reveal + Guess Robustness)
- Ran `npm test`: pass (12 tests).
- Ran `npm run lint`: pass.
- Ran `npm run build`: pass (PWA build complete; existing chunk-size warning remains).
- Ran develop-web-game Playwright client smoke check and reviewed generated screenshot/state artifact from the latest run.

## Remaining TODOs / Suggestions
- Add a dedicated end-to-end scripted flow that seeds players and drives setup -> reveal -> discussion automatically for stronger browser-level regression coverage.
- Consider exposing explicit test hooks/ids for key reveal controls to reduce brittle selector logic in automated UI tests.

## Progress Log
- Implemented ALAMEL-X OLED Noir HUD overhaul (phase 1-4) with a locked void palette and cinematic shell overlays.
- Added reusable `GameButton` (`src/components/GameButton.tsx`) and migrated core gameplay CTAs (setup, reveal, discussion, resolution, summary) to tactile motion interactions.
- Rebuilt `HomeScreen` into a single-view HUD: title stack, breathing `START MISSION` bar, and bottom utility icon strip (Players/History/Settings).
- Added History utility deep-link behavior (`/players?focus=history`) and focus handling in `PlayersScreen`.
- Locked runtime/persisted theme behavior to onyx/noir while preserving settings schema compatibility.
- Updated settings UI to remove theme switching and show locked-theme messaging.
- Added/updated tests for the new Home HUD contract and History navigation path.

## Validation Update (OLED Noir HUD)
- `npm run lint`: pass.
- `npm run test`: pass (13 tests).
- `npm run build`: pass (PWA output generated; existing chunk-size warning remains).
- Ran develop-web-game Playwright client flows for Home/History/Settings using local dev server.
- Reviewed latest screenshots:
  - `output/web-game/mission/shot-0.png`
  - `output/web-game/history/shot-0.png`
  - `output/web-game/settings/shot-0.png`
- Reviewed text-state artifacts:
  - `output/web-game/mission/state-0.json` (`screen: "/"`)
  - `output/web-game/history/state-0.json` (`screen: "/players"`)
  - `output/web-game/settings/state-0.json` (`screen: "/settings"`)

## Remaining TODOs / Suggestions
- The Playwright helper's `--click-selector #start-mission-btn` can fail because the continuous breathing animation keeps the element "unstable" for Playwright's strict click check; keep coordinate click fallback or expose a non-animated test hook variant during automated runs.
- Consider adding a visual regression snapshot baseline for the new Noir HUD to detect style drift.

## Validation Addendum (Playwright Artifacts Final)
- Re-ran Playwright visual checks into dedicated artifact folders to avoid mixing with older runs:
  - `output/web-game/mission-v3`
  - `output/web-game/history-v3`
  - `output/web-game/settings-v3`
- Verified updated state payloads:
  - `output/web-game/mission-v3/state-0.json` -> `screen: "/"`
  - `output/web-game/history-v3/state-0.json` -> `screen: "/players"`
  - `output/web-game/settings-v3/state-0.json` -> `screen: "/settings"`

## Validation Addendum (Test Coverage)
- Added Home navigation test for mission button routing to setup when no active match is present.
- Current suite: `npm run test` pass (14 tests).

## Progress Log
- Locked scroll region flex sizing to ensure internal scrolling works inside ScreenScaffold.
- Restored global text-selection policy to include all [contenteditable] nodes and added -webkit-user-select reset.
- Tightened home navigation test to assert history focus highlighting class when deep-linked.
