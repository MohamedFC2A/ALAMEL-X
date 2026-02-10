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

## Progress Log
- Upgraded `src/lib/ai/agent.ts` with a stronger tactical persona ("agent" style with confident, intimidating tone) for chat responses.
- Added per-turn directive generation so chat replies adapt by role and user intent (especially direct word-leak attempts).
- Added reply post-processing to keep responses concise and sharp (max two sentences) and reduce weak/rambling output.
- Extended context payload to include thread summary when available for better continuity.
- Hardened vote/guess prompting to request confidence + tactical reason while preserving strict JSON choice parsing.
- Added test coverage in `src/lib/ai/agent.test.ts` to ensure replies stay concise under the new behavior.

## Validation Update (AI Persona Upgrade)
- `npm run lint`: pass (only pre-existing warnings in `src/screens/ResolutionScreen.tsx`).
- `npm run test`: pass (35 tests).

## Progress Log
- Implemented a focused UI/UX polish pass across shell + components + interaction surfaces.
- Updated route/page transitions in `src/App.tsx` to respect `reducedMotionMode` and `animationSpeed` at runtime.
- Updated `src/screens/HomeScreen.tsx` mission pulse animation to disable cleanly in reduced-motion mode and scale with animation speed.
- Restored `scroll` behavior support in `src/components/ScreenScaffold.tsx` so screens can explicitly request `auto` vs `none`.
- Enhanced card visual hierarchy and readability in `src/styles/components.css`:
  - richer glass gradient layering
  - subtle hover affordance for info cards
  - improved banner structure and spacing
  - stronger primary action bar glass treatment
- Upgraded button UX in `src/styles/components.css`:
  - clearer focus-visible ring
  - tactile hover/active feedback
  - improved disabled treatment
  - better text wrapping/legibility on labels
- Improved form field UX in `src/styles/components.css`:
  - smoother focus transitions
  - stronger focus contrast
  - placeholder readability
  - range accent alignment
- Improved modal UX in `src/styles/components.css`:
  - stronger backdrop clarity
  - elevated modal depth
  - standardized modal section grouping (`.modal-section`)
  - action row separation
- Improved header/shell layout balance in `src/styles/layout.css`:
  - refined header panel depth
  - better center-column title constraints
  - tighter mobile header grid behavior
  - safer scroll-region bottom padding with safe-area awareness
- Added `data-motion` runtime attribute in `src/App.tsx` and corresponding hard motion reduction rule in `src/styles/utilities.css`.
- Added global readability polish in `src/styles/base.css` (`text-rendering`, safer button select behavior, themed `::selection`).

## Validation Update (UI/UX Polish)
- `npm run lint`: pass (same pre-existing warnings in `src/screens/ResolutionScreen.tsx`).
- `npm run test`: pass (35 tests).
- `npm run build`: pass (existing chunk-size warning unchanged).
- Ran develop-web-game Playwright client and generated fresh visual artifact folder:
  - `output/web-game/uiux-pass-1`
- Reviewed screenshot artifact:
  - `output/web-game/uiux-pass-1/shot-0.png`
- Reviewed state artifact:
  - `output/web-game/uiux-pass-1/state-0.json`

## Progress Log
- Upgraded AI voice-room UX in `src/components/AiDeskModal.tsx`:
  - added live responder identity display (`active AI name`)
  - added dynamic voice-state display (`جاهز / يستمع / يفكّر / يتكلم`)
  - added animated voice-wave visualization for listening/speaking/processing states
  - added explicit speech-stop action while AI is talking
- Improved speech naturalness pipeline in `src/components/AiDeskModal.tsx`:
  - text humanization pass before TTS (cleanup + punctuation smoothing + acronym readability)
  - slower/more natural prosody tuning for Arabic voice playback
  - session-safe speech cancellation to prevent overlap/choppy output between turns
  - stronger voice scoring preference toward more human-like neural voices
- Added new locale keys for voice states and controls in `src/lib/i18n.ts`.
- Added full styling for responder card and waveform animation in `src/styles/components.css`.

## Validation Update (AI Voice Identity + Animation)
- `npm run lint`: pass (only existing warnings in `src/screens/ResolutionScreen.tsx`).
- `npm run test`: pass (35 tests).
- `npm run build`: pass (existing bundle-size warning unchanged).

## Progress Log
- Switched Arabic speech preference to Egyptian Arabic in `src/components/AiDeskModal.tsx`.
- Added strict `ar-EG` preference scoring and stronger penalties for non-Egyptian Arabic alternatives.
- Updated speech output locale to `ar-EG` and voice input locale to `ar-EG` for consistent Egyptian voice interaction.
- Expanded voice-name hints to better catch Egyptian female voice packs when available on the device/browser.

## Validation Update (Egyptian Arabic Voice Preference)
- `npm run lint`: pass (same pre-existing warnings in `src/screens/ResolutionScreen.tsx`).
- `npm run test`: pass (35 tests).
## Progress Log
- Completed AI intelligence/settings upgrade validation pass and fixed the remaining failing unit test expectation for configurable reply length behavior.
- Updated `src/lib/ai/agent.test.ts` to align default concise-mode expectation with new `balanced` output limit and added explicit coverage for `aiReplyLength: short` enforcing a 2-sentence cap.
- Re-ran full quality gates after changes: tests/lint/build all passing (lint warnings remain pre-existing in `ResolutionScreen.tsx`).
- Ran develop-web-game Playwright client smoke run against local dev server and reviewed latest artifacts:
  - `output/web-game/shot-0.png`
  - `output/web-game/state-0.json`
- Confirmed no Playwright-captured console/page errors in this run.

## Validation Update (AI Settings + Reliability)
- `npm run test`: pass (36 tests).
- `npm run lint`: pass with existing warnings only.
- `npm run build`: pass.

## Remaining TODOs / Suggestions
- Optional next pass: tune ultra-human mode prompts further per role (citizen vs spy) with targeted A/B response samples for Egyptian Arabic tone quality.
- Optional: expose quick AI presets in settings (e.g., Fast Tactical / Human Balanced / Ultra Human) mapped to current granular controls for easier user onboarding.
## Progress Log
- Implemented voice quality and transcript-intelligence upgrade in `src/components/AiDeskModal.tsx`.
- Added stronger speech-text normalization pipeline (Arabic-friendly normalization + filler cleanup + wake phrase robustness).
- Added multi-hypothesis recognition handling (`maxAlternatives=3`) with confidence-aware candidate scoring and best-transcript selection.
- Added adaptive transcript refinement path via AI for low-confidence/noisy utterances before dispatching chat reply.
- Added microphone preflight capture with browser audio constraints (`echoCancellation`, `noiseSuppression`, `autoGainControl`) to improve capture quality and reduce failed starts.
- Added granular speech error mapping (no-speech / mic-access / network) for clearer recovery UX.
- Added new localization key in `src/lib/i18n.ts`: `aiVoiceMicAccessError`.

## Validation Update (Voice Quality + Smarter Analysis)
- `npm run lint`: pass (only existing warnings in `src/screens/ResolutionScreen.tsx`).
- `npm run test`: pass (36 tests).
- `npm run build`: pass.
- Ran develop-web-game Playwright smoke loop and reviewed artifacts:
  - `output/web-game/voice-quality-v2/shot-0.png`
  - `output/web-game/voice-quality-v2/state-0.json`
- No Playwright-captured console/page errors in this run.

## Remaining TODOs / Suggestions
- Add targeted unit tests for transcript scoring/refinement helpers in `AiDeskModal` to lock behavior under noisy Arabic input examples.
- Optional: add a user-facing "Voice Sensitivity" slider that tunes refine-threshold/confidence cutoffs.
## Progress Log
- Migrated DeepSeek client usage to a server-managed Vercel proxy path (`/api/deepseek/chat`) so the browser no longer sends or stores API keys.
- Added Vercel serverless function `api/deepseek/chat.js` to securely forward chat completion requests using `process.env.DEEPSEEK_API_KEY`.
- Updated settings UX to remove all API-key input/clear/show controls and replaced it with server-managed status messaging.
- Updated runtime gating so AI readiness depends on `aiEnabled` only (no user key requirement) in setup/discussion/resolution flows.
- Updated tests to reflect keyless UX and server-managed behavior:
  - `src/screens/SettingsScreen.ai.test.tsx`
  - `src/screens/ResolutionScreen.ai.test.tsx`

## Validation Update (Vercel-managed Key)
- `npm run lint`: pass (only existing warnings in `src/screens/ResolutionScreen.tsx`).
- `npm run test`: pass (36 tests).
- `npm run build`: pass.
- Ran develop-web-game Playwright smoke run and reviewed artifacts:
  - `output/web-game/vercel-proxy-ai/shot-0.png`
  - `output/web-game/vercel-proxy-ai/state-0.json`
- No Playwright-captured console/page errors in this run.

## Deployment Note
- Vercel environment variable required: `DEEPSEEK_API_KEY`.
## Progress Log
- Implemented ElevenLabs server proxies with secure server-side key usage:
  - `api/eleven/tts.js` (POST text -> audio/mpeg)
  - `api/eleven/stt.js` (POST base64 audio -> transcript JSON)
  - Added method guarding, payload-size limits, no-store cache headers, and upstream timeout/error mapping.
- Added reusable client voice layers:
  - `src/lib/ai/eleven-client.ts` for ElevenLabs STT/TTS and cancellable audio playback.
  - `src/lib/ai/browser-voice.ts` for browser STT/TTS fallback and speech cancellation.
- Added orchestrator domain logic:
  - `src/lib/ai/discussion-orchestrator.ts` with silence trigger rules, round-robin + suspicion target pick, yes/no question detection, suspicion scoring, and named transcript formatting.
  - `src/lib/ai/discussion-orchestrator.test.ts` with unit coverage.
- Implemented auto discussion AI orchestration:
  - `src/hooks/useAiDiscussionOrchestrator.ts` runs during discussion only, uses VAD (AnalyserNode + MediaRecorder), auto-intervenes on silence, tracks pending named target, applies yes/no strict replies, handles AI-to-AI responses, and writes thread lines with speaker names.
  - Added ElevenLabs-first speech pipeline with browser fallback for both STT and TTS.
- Upgraded AI behavior contract in `src/lib/ai/agent.ts`:
  - stronger Egyptian Arabic persona constraints,
  - new APIs: `generateDirectedQuestion`, `decideYesNo`, `generateSuspicionInterjection`.
  - Added tests in `src/lib/ai/agent.test.ts` for strict yes/no output behavior.
- Updated UI/UX for orchestrated discussion:
  - `src/screens/DiscussionScreen.tsx` now starts orchestrator automatically in discussion phase and shows live status strip (`يسمع/بيحلل/بيتكلم/مستني رد`).
  - Rebuilt `src/components/AiDeskModal.tsx` into a monitor/control panel (runtime pause/resume + last speaker/transcript/intervention + pending target).
  - Added styles for monitor/strip in `src/styles/components.css`.
- Extended settings/type model:
  - `aiVoiceProvider: 'elevenlabs' | 'browser'`
  - `aiAutoFacilitatorEnabled: boolean`
  - `aiSilenceThresholdMs: number`
  - Added orchestrator + Eleven request/response interfaces in `src/types.ts`.
  - Added settings controls in `src/screens/SettingsScreen.tsx` and persistence test updates in `src/screens/SettingsScreen.ai.test.tsx`.
- Added screen-level AI UI test: `src/screens/DiscussionScreen.ai.test.tsx`.
- Added/updated i18n keys for orchestrator statuses, monitor text, fallback messages, and new settings labels.

## Validation Update (AI Orchestrator + ElevenLabs Integration)
- `npm run test`: pass (45 tests).
- `npm run lint`: pass with existing pre-existing warnings only in `src/screens/ResolutionScreen.tsx`.
- `npm run build`: pass (existing chunk-size warning unchanged).
- Ran develop-web-game Playwright client smoke runs and reviewed generated artifacts:
  - `output/web-game/ai-orchestrator-smoke/shot-0.png`
  - `output/web-game/ai-orchestrator-discussion-entry/shot-0.png`
  - `output/web-game/ai-orchestrator-step2/shot-0.png`
- No new Playwright-captured runtime errors in generated artifact folders.

## Remaining TODOs / Suggestions
- Add a deterministic browser-seed helper for IndexedDB so Playwright smoke runs can directly enter discussion with pre-seeded AI players and showcase orchestrator visuals in screenshot artifacts.
- Add focused tests for fallback branches inside `useAiDiscussionOrchestrator` (Eleven STT fail -> browser STT, Eleven TTS fail -> browser TTS) using mocked media APIs.
- Expose optional advanced setting for post-question answer window (`7000ms`) if gameplay tuning requires it.

## Deployment Note
- Required new environment variables for production runtime:
  - `ELEVENLABS_API_KEY`
  - `ELEVENLABS_VOICE_ID` (recommended)
- Optional tuning variables:
  - `ELEVENLABS_TTS_MODEL_ID`
  - `ELEVENLABS_STT_MODEL_ID`

## Progress Log
- Added ElevenLabs diagnostics endpoint `api/eleven/health.js` to verify server key + available voices and return detailed actionable errors.
- Hardened `api/eleven/tts.js` voice selection with automatic fallback to an available account voice when the configured/requested voice is invalid.
- Expanded settings diagnostics in `src/screens/SettingsScreen.tsx`:
  - Connection test (`/api/eleven/health`) with detailed result payload.
  - Random speech test that picks a random available voice and plays a live sample.
  - Detailed failure rendering for auth/network/upstream issues.
- Added/updated i18n copy for ElevenLabs diagnostics and AI intervention rest setting.
- Added `aiInterventionRestMs` setting (default `9000ms`) and wired orchestrator cooldown to enforce pause between silence-triggered AI questions.
- Improved spy AI uncertainty behavior in `src/lib/ai/agent.ts` so spy responses avoid overconfident certainty terms and maintain uncertain phrasing.
- Added tests for the new settings diagnostics flow and spy uncertainty behavior:
  - `src/screens/SettingsScreen.ai.test.tsx`
  - `src/lib/ai/agent.test.ts`

## Validation Update (Eleven Diagnostics + Spy/Rest Tuning)
- `npm run test`: pass (47 tests).
- `npm run lint`: pass with existing warnings only in `src/screens/ResolutionScreen.tsx`.
- `npm run build`: pass.
- `npm run test:elevenlabs`: fail in current local environment because `ELEVENLABS_API_KEY` is missing.

## Remaining TODOs / Suggestions
- Validate ElevenLabs end-to-end with real environment variables in deployment/runtime target (local environment currently has no ElevenLabs key configured).

## Progress Log
- Hardened ElevenLabs diagnostics UX:
  - `SettingsScreen` now detects non-JSON health responses and shows a runtime hint when `/api` endpoints are unavailable in the current runtime.
  - `speakWithEleven` now validates `content-type` and raises a detailed `invalid_response` error if TTS returns non-audio payloads.
- Improved local diagnostics script:
  - `scripts/test-elevenlabs.mjs` now auto-loads `.env.local` then `.env` before checking environment variables.
  - Updated missing-key error text to explicitly mention env file locations.

## Validation Update (Diagnostics Hardening)
- `npm run test`: pass (47 tests).
- `npm run lint`: pass with existing warnings only in `src/screens/ResolutionScreen.tsx`.
- `npm run build`: pass.
- `npm run test:elevenlabs`: fail in current local environment because `ELEVENLABS_API_KEY` is still missing.

## Progress Log
- Updated ElevenLabs STT default model in `api/eleven/stt.js` from `scribe_v1` to `scribe_v2` for higher baseline transcription quality (still overridable via `ELEVENLABS_STT_MODEL_ID`).

## Progress Log
- Fixed discussion-phase speech regression where AI voice playback was being interrupted by orchestrator re-bootstrap on every active-match thread update.
  - `src/hooks/useAiDiscussionOrchestrator.ts` now derives run conditions from stable scalar deps (`activeMatchId`, `matchStatus`, voice flags, thresholds) instead of full `activeMatch/settings` objects.
- Switched AI discussion TTS path to ElevenLabs-only (removed browser speech synthesis fallback in gameplay orchestrator).
- Added WebAudio playback path for ElevenLabs output in `src/lib/ai/eleven-client.ts` (uses provided `AudioContext` when available, then falls back to `HTMLAudioElement`).
- Locked UI provider control to ElevenLabs in settings and removed browser option from runtime selection:
  - `src/screens/SettingsScreen.tsx`
  - `src/lib/db.ts` (`ensureSettings` now normalizes `aiVoiceProvider` to `elevenlabs`)
  - Added copy key `aiVoiceProviderLocked` in `src/lib/i18n.ts`.
- Updated settings AI tests for provider lock behavior:
  - `src/screens/SettingsScreen.ai.test.tsx`.

## Validation Update (Discussion Voice Stability + Eleven-only TTS)
- `npm run test`: pass (47 tests).
- `npm run lint`: pass with existing warnings only in `src/screens/ResolutionScreen.tsx`.
- `npm run build`: pass.

## Progress Log
- Diagnosed production `/api/eleven/tts` failures as upstream 404 (`voice_id not found`) rather than missing endpoint.
- Hardened `api/eleven/tts.js` with a one-time self-healing retry:
  - First attempt uses configured/requested `voice_id`.
  - If ElevenLabs returns `voice_id ... not found` (404), cache is cleared and a fallback valid voice is auto-resolved from account voices, then retried once.
  - Prevented stale invalid voice IDs from being re-cached.

## Validation Update (TTS Self-Healing Retry)
- `npm run test`: pass (47 tests).
- `npm run lint`: pass with existing warnings only in `src/screens/ResolutionScreen.tsx`.
- `npm run build`: pass.

## Progress Log
- Upgraded AI personality + dialogue quality in `src/lib/ai/agent.ts`:
  - Stronger Egyptian colloquial style with light comedic tone.
  - Better suspicion phrasing prompts (including accusatory style cues).
  - Faster default response-shape token budgets for snappier replies.
- Fixed spoken output formatting in discussion orchestrator:
  - AI no longer speaks prefixed agent names like `العميل ...:`.
  - Yes/No spoken replies are now just `أه` / `لا` without name prefix.
  - Added target-name stripping to prevent duplicate target name mention in directed questions.
- Tightened discussion-only behavior:
  - Added `isDiscussionLive` guards so async interventions/speech stop cleanly outside discussion phase.
  - Removed browser STT fallback from orchestrator path (ElevenLabs-only STT/TTS behavior in gameplay path).
- Added richer AI vote behavior in resolution:
  - New `decideVoteDetailed` API returns `{ choice, reason }` with Egyptian suspicion wording.
  - AI vote handoff now shows the reason and attempts ElevenLabs TTS before auto-submitting the vote.
- Updated tests:
  - `src/lib/ai/agent.test.ts` new coverage for vote-reason shape.
  - `src/screens/ResolutionScreen.ai.test.tsx` updated to mock `decideVoteDetailed` + `speakWithEleven`.
  - `src/screens/ResolutionScreen.test.tsx` voting tests got explicit timeout to reduce CI/runtime flake.

## Validation Update (AI Persona + Speech/Flow polish)
- `npm run test`: pass (48 tests).
- `npm run lint`: pass with existing warnings only in `src/screens/ResolutionScreen.tsx`.
- `npm run build`: pass.
## Progress Log
- Fixed ElevenLabs STT endpoint behavior for silence chunks: `api/eleven/stt.js` now returns HTTP 200 with `{ noSpeech: true }` when transcript text is empty instead of forcing a 502 error.
- Increased STT timeout to 28s and added stronger diagnostics (`details`) for upstream failures/timeouts.
- Added base64 sanitizer for STT payloads to support `data:*;base64,...` input safely.
- Updated client types/mapper (`src/types.ts`, `src/lib/ai/eleven-client.ts`) to consume `noSpeech` and avoid treating silence as a fatal error.
- Suppressed i18next support spam banner by setting `showSupportNotice: false` and `debug: false` in `src/lib/i18n.ts`.
- Added runtime error noise filter in `src/main.tsx` to ignore third-party Chrome extension exceptions (`chrome-extension://...`) so game debugging remains clean.
- Added `vercel.json` with API passthrough + SPA fallback routing to prevent route-level 404s on deep links (e.g. `/play/discussion`).
- Updated Arabic settings copy to reflect ElevenLabs-only in-game voice path.

## Validation Update (STT + Routing + Noise)
- `npm run lint`: pass (4 existing warnings in `src/screens/ResolutionScreen.tsx`, no new lint errors).
- `npm run test`: pass (48 tests).
- `npm run build`: pass.
- Ran develop-web-game Playwright client against live URL and produced fresh artifacts at:
  - `output/web-game/shot-0.png`
  - `output/web-game/shot-1.png`
  - `output/web-game/state-0.json`
  - `output/web-game/state-1.json`
- Playwright console-error artifact was not produced (no captured page errors in that run).

## Remaining TODOs / Suggestions
- Redeploy on Vercel to apply the new `vercel.json` routing behavior and STT endpoint changes in production.
- After deploy, verify `/api/eleven/stt` with a real discussion flow (non-empty speech + silence chunk) to confirm no more false 502 for silence.
- Optional: add a tiny UI badge in AI monitor for `noSpeech` events for easier operator debugging.
