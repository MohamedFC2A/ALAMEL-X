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

## Progress Log
- Executed RTL/UI hotfix pass focused on mobile-first stability and contrast.
- Updated `src/index.css` with stronger subtitle wrapping, subtle text legibility, custom internal scrollbar styling, and improved case action layout behavior.
- Refined mobile header composition so metadata/actions stay stable in one lane without overlap on 390px.
- Improved Players card readability by fixing `stats-grid` wrapping/line-height and mobile column behavior.
- Captured refreshed before/after style outputs in `output/` including mobile + desktop shots for Home/Players/Settings/Setup/Reveal/Discussion/Resolution/Summary.
- Ran develop-web-game client loop and produced fresh artifacts in:
  - `output/web-game/home-v5`
  - `output/web-game/players-v5`
  - `output/web-game/settings-v5`
  - `output/web-game/setup-v5`
  - `output/web-game/reveal-v5`
  - `output/web-game/discussion-v5`
  - `output/web-game/resolution-v5`
  - `output/web-game/summary-v5`

## Validation Update (RTL/UI Hotfix)
- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: fails in this environment due Vitest runner-resolution issue when invoked via npm/local binary.
- Equivalent suite validation passed with:
  - `npx -y vitest run --config c:/Projects/SUSAWI/vite.config.ts` (16 tests passed).
- Playwright console check (error level): no console errors.

## Remaining TODOs / Suggestions
- Investigate local `npm run test` runner-resolution mismatch (likely tooling/env quirk) to keep CI/local command parity.
- If desired, add deterministic IndexedDB seed helper for screenshot scenarios so `render_game_to_text` route states remain stable across fresh browser contexts.

## Progress Log
- Implemented UI rebalance pass across core screens (`/`, `/players`, `/settings`, `/play/setup`) with RTL-safe logical CSS adjustments.
- Added global line-height tokens in `src/styles/base.css` and removed broad `span` line-height coupling to reduce cramped text blocks.
- Rebuilt Players card layout in `src/styles/components.css` from fragile flex stacking to responsive grid areas, removing mobile overflow/void spacing caused by `flex: 1` on `.player-main`.
- Converted setup/resolution/choice/player grids from rigid center placement to `auto-fit/minmax` with stretch alignment for cleaner balance across desktop and mobile.
- Tightened settings section rhythm and card spacing; aligned mobile card paddings to spacing tokens for consistent App-like density.
- Updated `src/styles/layout.css` scroll region paddings and mobile shell in logical properties to avoid edge collisions on 390px.

## Validation Update (UI Rebalance)
- `npm run test`: pass (16 tests).
- `npm run build`: pass (PWA artifacts generated; existing chunk-size warning unchanged).
- Playwright checks completed on Desktop + Mobile for `/`, `/players`, `/settings`, `/play/setup`.
- Interaction checks confirmed single-tap behavior for:
  - Home navigation buttons.
  - Players edit/toggle actions.
  - Settings update/check button (`تحديث اللعبة` -> `اللعبة محدّثة` state observed).
- Long Arabic player name scenario verified on mobile: no horizontal overflow or card breakage in players list.
## Progress Log
- Applied mobile-first layout stabilization pass across `src/styles/base.css`, `src/styles/layout.css`, and `src/styles/components.css`.
- Added safe-area-aware shell paddings and min viewport guards (`vh/svh/dvh`) to reduce clipping on small phones.
- Improved scroll resilience by allowing `screen-scroll-region--none` to become vertical-scroll on narrow/short viewports.
- Reworked mobile header grid behavior to prevent title/subtitle/home-link collisions.
- Rebalanced action bars, player rows/actions, stats grid, spy-count controls, and long-text wrapping for Arabic-heavy UI.
- Updated modal max-height to `dvh` and hardened banner/chip/choice-card word wrapping.

## TODO (Current)
- Run lint/test/build and inspect for regressions.
- Run Playwright mobile verification loop and compare before/after screenshots.
## Validation Update (Mobile Layout Rebalance)
- `npm run lint`: pass.
- `npm run test`: pass (23 tests).
- `npm run build`: pass (PWA artifacts generated; existing chunk-size warning unchanged).
- Ran develop-web-game Playwright client (skill script) and generated fresh artifacts:
  - `output/web-game/mobilefix-home`
  - `output/web-game/mobilefix-players`
  - `output/web-game/mobilefix-settings`
  - `output/web-game/mobilefix-setup`
  - `output/web-game/mobilefix-reveal`
- Verified corresponding text-state payloads for captured routes (home/players/settings).
- Ran direct Playwright viewport verification at `390x844` for:
  - `/`
  - `/play/setup`
  - `/players`
  - `/settings`
  - `/play/reveal`
  - `/play/discussion`
  - `/play/resolution`
  - `/play/summary`
- Console error check in browser session: no errors.

## Remaining TODOs / Suggestions
- If you want an even tighter mobile feel, we can make a second pass specifically for `setup-insights` visual density (typography scale + contrast) on <=390px.
- Optional: add screenshot regression checks for 390x844 in CI to catch future layout drift.
## Progress Log
- Reproduced user-reported bug on mobile setup screen: spy-count selector was visually/interaction-blocked by the sticky action bar overlap.
- Implemented targeted mobile fix in `src/styles/components.css`: on `max-width: 560px`, both `.sticky-action-bar` and `.reveal-action-bar` switch to non-sticky flow (`position: static`) to prevent control occlusion.
- Verified interaction in Playwright at `390x844`: clicking spy count `2` updates HUD spy count from `1` to `2` and active pill state toggles correctly.

## Validation Update (Spy Count Fix)
- `npm run lint`: pass.
- `npm run test`: pass (23 tests).
- `npm run build`: pass.
- develop-web-game client run completed after fix:
  - `output/web-game/spycount-fix-verify`
- Browser-side verification screenshot:
  - `spycount-after-fix-click.png`

## Progress Log
- Reworked AI desk interaction to voice-first "room" mode in `src/components/AiDeskModal.tsx`.
- Removed manual chat input/send/question flow from AI modal; now interaction is microphone-driven only.
- Added wake-name resolution for AI agents from spoken text (no manual agent selection required).
- Implemented spoken-name stripping and prompt cleaning before dispatching model requests.
- Improved TTS output selection by choosing the best available language voice and increasing Arabic speaking speed.
- Added resilient speech-recognition handling for interim/final transcripts and no-speech error feedback.
- Tuned AI behavior prompt in `src/lib/ai/agent.ts` to be more cooperative, indirect, and less interrogative when not spy.
- Updated AI runtime generation defaults (lower temperature, controlled tokens) for faster and tighter responses.
- Added new Arabic localization strings for voice-only UX state/messages in `src/lib/i18n.ts`.
- Added voice-room styles for the updated modal in `src/styles/components.css`.

## Validation Update (AI Voice-Only Room)
- `npm run lint`: pass (existing pre-existing warnings in `src/screens/ResolutionScreen.tsx`, no new lint errors).
- `npm run test`: pass (34 tests).
- `npm run build`: pass (existing chunk-size warning remains).
- Ran develop-web-game Playwright client and generated fresh artifact folder:
  - `output/web-game/ai-voice-v1`
- Verified screenshot artifact:
  - `output/web-game/ai-voice-v1/shot-0.png`
- Verified state payload artifact:
  - `output/web-game/ai-voice-v1/state-0.json`
- Console error artifact file not generated by the helper in this run (no runtime failure during capture).

## Remaining TODOs / Suggestions
- Add a dedicated UI test for the voice-only AI modal states (idle/listening/processing/error) to guard regressions.
- Consider adding a small debounce + confirmation tone before recording starts for better UX in noisy rooms.
- If desired, add an "always listening for wake word" mode behind a setting (currently tap-to-record for reliability/privacy).
