# Changelog

All notable changes to this project are documented in this file.

---

## alpha v0.3.0 — 2026-05-06

Version delta from previous release: `Alpha_2.5.0` → `alpha v0.3.0`

### Features

- **Season Hub screen** — new top-level screen providing an overview of the season, demo mode support, and simplified session/mode handling replacing the session browser.
- **GlobeCalendar screen** — interactive 3D globe with per-circuit camera altitude, focused-circuit state, arc animations isolated into a `GlobeView` component, and rich circuit metadata/history display.
- **Smooth scroll** — `useSmoothScroll` hook providing eased, touch-like wheel scrolling applied app-wide.
- **News headlines** — RSS headlines endpoints (`/headlines`, `/headlines/image`) added to the FastF1 bridge with caching and OG image extraction; ESPN RSS feed included as a source.
- **Expanded FastF1 bridge** — added `/drivers`, `/timing`, `/telemetry/latest`, and `/locations` endpoints; per-session start/end times; safe ISO date handling and session date resolution helpers.
- **Auto-select FastF1 session** — frontend now automatically resolves the correct FastF1 session and prefers FastF1 data over OpenF1 where available.
- **Track SVG improvements** — track alignment script, SVG rotate support, and adjusted filter/visual styling for circuit overlays.
- **Season standings panel** — `SeasonStandings` refactored to a panel-style component; Jolpica constructor standings fetch added.
- **Globe/calendar & standings UI polish** — visual and layout updates to `GlobeCalendar` and `SeasonStandings` components.
- **GitHub Actions CI** — build/release workflow added (`.github/workflows/build.yml`).

### Fixes & Changes

- Removed FIA race-control feed from news sources.
- Removed "powered by OpenF1" branding from app description.
- Added OpenF1 API key validation.
- Canvas grid config updated to prevent widget collisions.
- `DiagnosticLog` mode options adjusted.

### Electron

- **`app://` protocol** — renderer windows now load via a privileged `app://` custom scheme (`loadURL` instead of `loadFile`) so query params survive across the main/pop-out window lifecycle; path traversal is rejected for out-of-root requests in production builds.
- Version bumped to `0.3.0-alpha` in `package.json` and `appMeta.ts`.

---

## Alpha_2.5.0 — 2026-04-29

Version delta from previous release: `alpha v0.1.8` → `Alpha_2.5.0`

### Features

- **FastF1 Python bridge** — `pitwall/bridge/fastf1_server` introduced: a Flask server exposing FastF1 telemetry, positions, laps, stints, intervals, weather, and race-control data; Electron `f1store.cjs` SQLite store added alongside bridge.
- **2026 season assets** — bulk-added 2026 track display SVGs, YAML circuit data, detailed track images, and F1DB JSON dataset (drivers, races, standings 1950–2026).
- **Season standings UI** — standings screen and `useSeasonStandings` hook backed by Jolpica API.
- **NextRaceDisplay** — component showing countdown and context for the upcoming race.
- **Next-race detection** — live-mode prompt and automatic next-race detection added to app session flow.
- **Unified data-source UI** — onboarding state persisted across sessions; data-source selector UI consolidated.
- **Widget manifest** — `widgets/manifest.ts` and `widgetUtils.tsx` introduced; `WidgetPicker` migrated to manifest-driven `WIDGET_PICKER_LIST` / `WIDGET_CATEGORY_MAP`.
- **New widgets** (all registered in manifest):
  - `LastLapCard` — focused last-lap timing card.
  - `LiveLapTimeCard` — live lap timer with PB delta context.
  - `SectorMiniCards` — per-sector mini timing panels.
  - `CarVisualization` — telemetry-driven car visual with tyre/DRS state.
  - `SpeedGauge` — live speed gauge sourced from car telemetry.
  - `GapEvolutionChart` — gap-to-leader chart over lap history.
  - `DRSEfficiency` — DRS open/closed efficiency analysis widget.
  - `DegRateGraph` — tyre degradation rate graph.
  - `ERSMicroSectors` — ERS deployment visualisation by sector.
  - `ChampionshipCalculator` — hypothetical points/standings calculator.
- **New hooks** — `useCarData`, `useLocation`, `useTeamRadio`, `useCircuitMap`, `useTrackDisplayAsset`, `useTrackDetailAsset`, `usePredictiveLapTime`, `useWidgetConfig`.
- **FullTrackMap overhaul** — renders real circuit outline from FastF1 circuit map or accumulated live positions; falls back to static SVG asset while outline builds.
- **Circuit map caching** — `circuitMapCache`, `trackNormalizer`, and `melbourneCircuitMap` added; Melbourne 2025 FastF1 cache pre-bundled.
- **Markdown component** — `src/components/Markdown/Markdown.tsx` added for rendering markdown content in widgets/panels.
- **DriverChipPicker** — reusable driver-selection component.
- **WeatherRadar** — overlays and auto-recenter behaviour added.
- **RadioFeedText / RadioScanner widgets** — team radio transcript and live scanner UI.
- **CONTRIBUTING.md** — project contribution guidelines document added.
- **GNU GPL v3 license** — license file added to repository.
- **Shared formatters** — `formatLap`, `formatDelta`, `formatTime` etc. extracted to shared utilities; `LapDeltaTower`, `LapTimeCard`, `StintPaceComparison`, and `TyreIntelligence` updated to use them.

### Fixes & Changes

- `useLaps` / `useStints` guard added to prevent accidental full-session fetches when no driver is configured.
- `useRaceControl` integrates FastF1 race-control feed and skips OpenF1 polling when FastF1 is active.
- Incremental `date_gt` option added to `fetchCarData` for efficient live telemetry polling.
- Canvas layout migration logic generalised; `minHeight` enforcement and legacy `RunningOrderStrip` fix added.
- Legacy `LapTimeCard` (v1) and spec placeholder entries removed.
- `--muted2` CSS variable updated in `index.css`.

---

## alpha v0.1.8 — 2026-04-05

Version delta from previous release: `alpha v0.1.5` → `alpha v0.1.8` (`+0.03`)

### Features

- **Local database cache** (`intervalCache.ts`, IndexedDB) for interval/gap timeline data.
  - `useIntervalHistory` — full timeline data, cache-first in historical mode, fetch + merge + persist in live mode, fallback to cache on API failure.
  - `useIntervals` — current/latest-per-driver data, preserving existing widget behavior.
  - *Note: full database implementation is ongoing; this entry documents the roadmap and cache architecture.*
- **Widget pop-out windows** — widgets can open in dedicated Electron pop-out windows with dock-back and drag-to-dock support; warm window reuse and bootstrap/reset lifecycle handling.
- **Cross-window live state sync** — session, ambient, and driver-focus state synchronise across main and pop-out windows; pop-outs consume startup transfer payloads and restore widget context.
- **New widgets** — Lap Time Card (focused single-driver lap timing with live-lap timer and PB delta) and Stint Pace Comparison (side-by-side tyre-age pace comparison with shared-age analysis).
- **Lazy widget resolution** — widget modules load on demand; pop-out bootstrap preloads modules to reduce blank startup time.
- **Focus-editor workflow** — `FocusStrip` supports editing focus context per widget; driver context editing supports inherit/fixed/race-position and pinned-driver patterns.
- **Widget settings depth** — driver tab supports multi-driver configuration for comparison widgets; inferred widgets expose formula-oriented settings more consistently.
- **App shell & startup UX** — startup routing selects main vs pop-out app automatically; workspace persistence separates main and pop-out windows; version surfacing refined.
- **Developer diagnostics** — additional Electron debug bridge actions (mode toggles, overlays, ambient/leader color presets, logging helpers); window-dimension diagnostics added.

---

## alpha v0.1.5 — 2026-03-XX

Initial public alpha release. Established the core Pitwall application architecture:

- Electron shell with React/TypeScript renderer and Vite build.
- OpenF1 API integration for live and historical session data.
- Draggable/resizable widget canvas (`react-draggable`, `react-resizable`).
- Initial widget set: Running Order Strip, Tyre Intelligence, Interval/Gap timeline, Pit Stop Log, Race Control Feed, Standings Board, Standings Table, Strategy Timeline, Radio Feed.
- Ambient race layer and developer tools UI.
- RGB bridge and peripheral adapter scaffold.
- 2026 car/track AVIF assets.
- Mode-based polling with rate-limit toasts.
