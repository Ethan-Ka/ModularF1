# Pitwall

Fan-built F1 race intelligence platform built on the [OpenF1 API](https://openf1.org). Provides real-time telemetry, inferred strategy metrics, ambient environment control, and a sharable layout system.

Current version: **alpha v0.1.5**

Not affiliated with Formula 1, FIA, or Formula One Management.

---

## Status snapshot (April 2026)

This README includes both implemented features and roadmap items. Current status:

| Area | Status | Notes |
|---|---|---|
| Core app shell, canvas, drag/drop workspace | ✅ Shipped | Multi-tab canvas, widget layout persistence, settings system |
| Ambient race layer and flag-state visuals | ✅ Shipped | Includes top chrome gradient/wave layers and transitions |
| 2026 season asset bundle | ✅ Shipped | Season index/manifest, track metadata, and track layout assets |
| Standings board widget | ✅ Shipped | Live projected driver + constructor points view |
| Full 33-widget catalog | 🟡 In progress | Several widgets are currently prototype placeholders |
| RGB bridge adapters (WLED/Hue/Govee) | 🟡 In progress | Bridge scaffolding and adapters exist; integrations are evolving |
| Overlay desktop/F1TV mode | 🔵 Planned | Roadmap item (Phase 4), not in the current release |

---

## Data source

All race data comes from OpenF1.

| Tier | Cost | What you get |
|---|---|---|
| Historical | Free | 2023–present sessions, all shipped widgets, inferred metrics where implemented, no live updates |
| Live | $10/month (your own key) | ~3-second real-time data, WebSocket feed, all 18 endpoints, team radio |

**You must provide your own OpenF1 API key for live data.** The key is stored in localStorage (desktop: OS keychain) and never sent to Pitwall's servers. All API calls go directly from your browser to `api.openf1.org`.

There is no workaround for live data. Real-time OpenF1 requires a paid subscription and Pitwall cannot relay it without violating OpenF1's terms.

---

## Features

### Widgets

Widget catalog target is **33 widgets across 8 categories**. The current build includes production widgets plus prototype placeholders for roadmap items. All widgets remain drag-and-drop. The Formula tab appears on inferred widgets where that logic is implemented.

**Timing & Gaps** (6 widgets)
- Lap Delta Tower — ranked list of all drivers with lap time, gap to leader, interval, and 3-lap trend arrow
- Lap Time Card — single-driver lap time with sector splits, personal best comparison, and 8-lap sparkline
- Gap Evolution Chart — line chart of gap between two configurable drivers across the session
- Stint Pace Comparison — average stint pace across drivers filtered to the same compound age window
- Head-to-Head Delta — two drivers, one configurable metric (lap time, top speed, sector, deg rate, traffic loss)
- Sector Mini-Cards — S1/S2/S3 time cards with session/personal best coloring and theoretical best lap

**Telemetry** (7 widgets)
- Speed Gauge — real-time speed readout with gear and rpm, radial gauge or numeric card, 3.7 Hz
- Throttle / Brake Trace — live scrolling throttle and brake chart, two-driver overlay, lap-aligned compare mode
- Gear Trace — step-line gear chart per corner with shift point markers, optional rpm overlay
- Throttle Heatmap — track outline colored by throttle or brake application, compare two drivers or two laps
- ERS Micro-Sectors — inferred deploy/harvest zones on track mini-map, battery SOC estimate, compare mode
- DRS Efficiency — speed gain per zone vs theoretical max, zone hit rate, activation timing
- Engine Mode Tracker — RPM ceiling hit rate as a proxy for engine deployment mode

**Tyres & Strategy** (6 widgets)
- Tyre Intelligence — compound, age, deg slope, predicted cliff lap, pit urgency score, user-editable formula
- Strategy Timeline — all drivers, all stints, compound colored, pit annotations, horizontal scroll by lap
- Deg Rate Graph — lap-time degradation scatter plot for current stint, traffic laps excluded
- Pit Window Urgency — composite 0–1 score from cliff proximity, gap behind, and undercut window
- Pit Stop Log — all stops with stationary time, total delta, and undercut/overcut outcome classification
- Undercut Simulator — what-if pit stop model against any rival using live pace and gap data

**Map & Position** (4 widgets)
- Full Track Map — live position dots for all 20 cars, battle proximity cones, zoom and pan, min 2×2
- Sector Map — track map with sector zones colored by current best time holder
- Running Order Strip — compact horizontal position strip, live on overtakes, 4×1 fixed
- Overtake Replay — animated micro-replay of any overtake event, scrub-able, sourced from /overtakes

**Weather & Conditions** (4 widgets)
- Weather Dashboard — air temp, track temp, humidity, wind, rainfall, tyre crossover indicator
- Track Temp Evolution — track temp chart with optional deg rate overlay on secondary axis
- Wind Direction — compass rose on track outline showing headwind/tailwind sectors
- Weather Radar — Windy iframe embed geo-locked to circuit, rain/wind/cloud/pressure/temp layers

**Audio & Comms** (3 widgets)
- Radio Scanner — multi-channel scanner with four modes, squelch, key-up SFX, Whisper transcription, keyword alerts
- Radio Feed (Text) — text-only transcript feed, searchable, keyword highlighting, no audio
- Race Control Feed — timestamped flag changes, penalties, investigations, DRS notifications

**Championship** (3 widgets)
- Standings Table — live driver and constructor standings with points gained this race
- Championship Calculator — what-if final standings with adjustable remaining race results
- Points Delta Tracker — points gap between two drivers race by race, mathematical championship limit line

**Visual** (1 widget)
- Car Visualization — 2026-regulation SVG side profile, team color stripe, tyre data on tyre circles, ERS/battery bars, damage row, telemetry stats strip

### Ambient race layer

A persistent banner communicates race state through color. On every flag change a toast notification announces the event text then fades out. The gradient color remains as a passive signal after the toast disappears.

State priority order: Red flag → Safety car → Virtual SC → Yellow flag → Fastest lap (2.8s pulse) → Lead change (team color flash) → Green (with or without leader team color).

An optional RGB bridge connects to WLED, Philips Hue, Govee, or MQTT so physical lights in the room follow the same events.

### Window and workspace system

A workspace is a named configuration containing canvases, a focus driver, ambient settings, and radio config. Multiple browser windows can show different canvas tabs from the same workspace and sync live via BroadcastChannel API (~16ms). Windows in different workspaces are fully independent.

### Driver context system

Every widget targets driver data through one of three mechanisms:

| Context | Indicator | Behavior |
|---|---|---|
| Canvas inherit | `FOCUS` | Default. Follows whatever driver the canvas is focused on. |
| Position role | `P1` / `P2` / `P3` / `GAP±1` | Follows the live race position. Auto-switches on position changes. |
| Specific driver | `PINNED` | Locked to one named driver regardless of any other changes. |

Widget border styles communicate context type: green dashed for FOCUS, gold dashed for role, purple dashed for PINNED.

### Layout export and sharing

Canvases export as a compact human-readable code string encoding all widget positions, sizes, driver contexts, formula overrides, and settings. Paste the code into Pitwall on any device to restore the layout exactly. No account required on either end.

Format:
```
pw:v1 · ws:"Race day" · focus:VER · theme:dark
widgets:[lap_delta·2x1, ers_deploy·1x1, tyre_age·1x1@NOR, traffic·1x1, battery·1x1, weather·1x1]
ambient:on · leader_color:on · rgb:wled · radio:scanner
```

### Inference engine

OpenF1 does not expose ERS state, battery level, tyre wear, fuel load, or engine mode. These are inferred from available telemetry. All inferred values carry an `~EST` label.

| Metric | Accuracy |
|---|---|
| Traffic time loss | ~85% |
| Deg rate | ~80% |
| Tyre cliff lap | ±3 laps |
| Pit urgency score | ~70% |
| ERS deploy zone | ~70% |
| Tyre wear % | ~65% |
| Engine mode | ~60% |
| Battery SOC | ~50% |
| Fuel load estimate | ~45% |

All formulas are editable in the widget's Formula tab. The formula builder shows a live preview against historical session data. Community formulas are publishable to a shared registry.

Default tyre cliff formula:
```
BASE_WINDOW = { SOFT: 18, MEDIUM: 28, HARD: 40, INTER: 35, WET: 50 }
CLIFF_LAP = stint_start_lap
           + BASE_WINDOW[compound]
           - (track_temp - 45) × 0.3
           - deg_rate × 1.8
           + sc_laps × 2.1
```

---

## Error handling

| State | Error code | Behavior |
|---|---|---|
| OpenF1 unreachable | `ERR_OPENF1_UNREACHABLE` | Auto-retry every 15s, show cached data |
| No network | `ERR_OFFLINE` | Offline banner, historical mode |
| Pre-session | `ERR_PRE_SESSION` | Countdown, polls for session every 60s, connects automatically |
| No season data | `ERR_NO_SEASON_DATA` | Season picker, 2023+ available |
| Update required | `ERR_UPDATE_REQUIRED` | Archive mode — full historical functionality, no live feed |
| Invalid API key | `ERR_INVALID_API_KEY` | Re-enter key screen, fall back to historical |

Archive mode keeps all 33 widgets functional on historical data. A persistent banner indicates archive status.

Diagnostic logs are accessible at Settings → Diagnostics. Last 1,000 entries retained in memory. Export as JSON. Optional opt-in Sentry integration for crash reporting (no personal data, no usage tracking).

---

## Quick start

```bash
git clone https://github.com/yourname/pitwall.git
cd pitwall
npm install
npm run dev
```

Open `http://localhost:5173`. On first launch you will be prompted for an OpenF1 API key. Skipping the key starts the app in historical mode.

---

## Project structure

```
pitwall/
├── src/
│   ├── app/              # App shell, workspace manager, BroadcastChannel sync
│   ├── widgets/          # All 33 widget components
│   │   ├── timing/       # T.1–T.6
│   │   ├── telemetry/    # L.1–L.7
│   │   ├── tyres/        # Y.1–Y.6
│   │   ├── map/          # M.1–M.4
│   │   ├── weather/      # W.1–W.4
│   │   ├── audio/        # A.1–A.3
│   │   ├── championship/ # C.1–C.3
│   │   └── visual/       # V.1
│   ├── ambient/          # Ambient bar, flag state machine, toast system
│   ├── drivers/          # Driver registry, team colors, season assets
│   ├── inference/        # Formula engine, tyre/ERS/traffic models
│   ├── api/              # OpenF1 REST client, WebSocket, caching
│   ├── errors/           # Error state machine, diagnostic log
│   └── radio/            # Scanner modes, squelch, SFX, Whisper transcription
├── bridge/               # Local Node RGB bridge
│   ├── index.js
│   └── adapters/
│       ├── wled.js
│       ├── hue.js
│       ├── govee.js
│       └── mqtt.js
├── assets/
│   ├── circuits/         # Circuit coordinates and SVG track outlines
│   ├── teams/            # Team color definitions per season
│   └── car/              # 2026-regulation car SVG base
└── docs/
    └── pitwall_master.html   # Full product specification
```

---

## Stack

| Layer | Technology |
|---|---|
| Core framework | React · TypeScript · Vite |
| Canvas grid | react-grid-layout |
| Charts | Recharts · D3 |
| State | Zustand · React Query · BroadcastChannel API · localStorage |
| Styling | Tailwind CSS |
| Audio | Web Audio API · AudioWorklet (squelch) · Whisper (transcription) |
| RGB bridge | Local Node.js · WebSocket → MQTT / WLED UDP / Philips Hue LAN / Govee LAN |
| Backend (community features) | Node.js · Fastify · Redis · PostgreSQL · tRPC |
| Error telemetry | Sentry (opt-in) |
| Desktop / overlay (Phase 4) | Electron or Tauri |

---

## Build phases

**Phase 1 — Foundation**
Canvas with named tabs, drag-and-drop grid, autosave, layout export/import, API key onboarding, session selector, driver manager, focus bar, ambient bar with flag states and toasts, Lap Delta Tower, Full Track Map, Tyre Intelligence, Weather Dashboard, Weather Radar, Running Order Strip, Race Control Feed.

**Phase 2 — Intelligence**
Inference engine, Formula tab, ERS Micro-Sectors, Battery SOC estimate, Traffic Time Loss, Pit Window Urgency, Undercut Simulator, Throttle/Brake Trace, Throttle Heatmap, Gear Trace, Speed Gauge, DRS Efficiency, Engine Mode Tracker, Car Visualization, Stint Pace Comparison, Deg Rate Graph, Pit Stop Log.

**Phase 3 — Community + Environment**
Local RGB bridge, WLED / Hue / Govee / MQTT adapters, Radio Scanner with squelch / key-up SFX / Whisper / keyword alerts, Radio Feed (Text), historical session replay, Overtake Replay, Strategy Timeline, Gap Evolution Chart, Head-to-Head Delta, Sector Mini-Cards, Championship widgets, community formula library, layout marketplace.

**Phase 4 — Desktop + Overlay**
Electron shell, transparent always-on-top overlay window, click-through boundaries, overlay layout mode, F1TV cockpit stream embeds if available, mobile responsive canvas, TV companion mode, push notifications.

---

## F1TV overlay (Phase 4)

Pitwall can run as a transparent overlay window above F1TV or any other streaming application using Electron's compositor-level window APIs. Pitwall draws on top — it does not capture, record, or re-transmit stream content. Compliance with F1TV terms of service is the user's responsibility. Phase 4 only, not yet built.

---

## OpenF1 API endpoints used

`/car_data` `/laps` `/intervals` `/position` `/location` `/stints` `/pit` `/weather` `/team_radio` `/race_control` `/overtakes` `/sessions` `/meetings` `/drivers` `/championship_drivers` `/championship_teams`

---

## Contributing

PRs welcome. Key areas:

- Formula improvements — better tyre cliff models, ERS detection, traffic loss
- Widget implementations — any widget in the catalog above not yet built
- RGB adapters — new device integrations in `/bridge/adapters/`
- Circuit database — coordinates and SVG outlines for any missing circuits
- Whisper integration — transcription accuracy improvements

Open an issue before starting large features.

---

## License

MIT — see [LICENSE](LICENSE).

OpenF1 data is used under OpenF1's terms of service. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V. Pitwall is an independent fan project not affiliated with Formula 1, FIA, or Formula One Management.
