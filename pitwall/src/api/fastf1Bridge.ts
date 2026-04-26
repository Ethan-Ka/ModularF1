// FastF1 bridge client — communicates with the local Python sidecar at localhost:7822.
// Types here are FastF1-native and richer than OpenF1 equivalents.
// Disk caching is handled by the Python server (FastF1's Parquet cache).
// React Query handles in-memory caching on this side.

const BASE_URL = 'http://127.0.0.1:7822'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FastF1Event {
  round_number: number
  event_name: string
  official_name: string
  circuit_name: string
  country: string
  date: string | null
  event_format: string
  sessions: Array<{ type: string; name: string }>
}

export interface FastF1Lap {
  Driver: string
  DriverNumber: string
  LapNumber: number
  LapTime: number | null          // seconds
  Sector1Time: number | null      // seconds
  Sector2Time: number | null
  Sector3Time: number | null
  Compound: string | null
  TyreLife: number | null
  FreshTyre: boolean
  Stint: number | null
  PitInTime: number | null        // seconds from session start
  PitOutTime: number | null
  IsPersonalBest: boolean
  IsAccurate: boolean
  TrackStatus: string | null
  SpeedI1: number | null          // km/h at intermediate 1
  SpeedI2: number | null
  SpeedFL: number | null          // finish line
  SpeedST: number | null          // speed trap
  Time: number | null             // seconds from session start (lap end)
}

export interface FastF1TelemetrySample {
  Time: number | null             // seconds from session start
  Date: string | null
  RPM: number
  Speed: number                   // km/h
  nGear: number
  Throttle: number                // 0–100
  Brake: boolean
  DRS: number
  Distance: number                // meters from session start
  X: number
  Y: number
  Z: number
}

export interface FastF1Stint {
  driver: string                  // abbreviation e.g. "VER"
  driver_number: string
  stint: number | null
  compound: string | null
  fresh_tyre: boolean | null
  tyre_life_start: number | null  // laps
  lap_start: number
  lap_end: number
  lap_count: number
}

export interface FastF1WeatherSample {
  Time: number | null             // seconds from session start
  AirTemp: number
  TrackTemp: number
  Humidity: number
  Pressure: number
  WindSpeed: number
  WindDirection: number
  Rainfall: boolean
}

export interface FastF1RaceControlMessage {
  Time: number | null
  UTC: string | null
  Category: string
  Message: string
  Flag: string | null
  Scope: string | null
  Sector: number | null
  RacingNumber: string | null
  Lap: number | null
  Status: string | null
  Domain: string | null
}

export interface FastF1Result {
  DriverNumber: string
  BroadcastName: string
  Abbreviation: string
  DriverId: string
  TeamName: string
  TeamColor: string | null
  FirstName: string
  LastName: string
  Position: number | null
  ClassifiedPosition: string | null
  GridPosition: number | null
  Q1: number | null               // seconds
  Q2: number | null
  Q3: number | null
  Time: number | null             // race time / gap in seconds
  Status: string | null
  Points: number
}

/** Identifies a session in FastF1's coordinate system. */
export interface FastF1SessionRef {
  year: number
  round: number
  session: string                 // 'R' | 'Q' | 'FP1' | 'FP2' | 'FP3' | 'S' | 'SQ'
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

async function f1Fetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    const err = new Error(`FastF1 bridge ${res.status}: ${path} — ${detail}`)
    ;(err as any).status = res.status
    throw err
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function checkFastF1Server(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(2_000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

export function fetchFastF1Events(year: number) {
  return f1Fetch<FastF1Event[]>('/events', { year })
}

export function fetchFastF1Laps(ref: FastF1SessionRef, driver?: string) {
  return f1Fetch<FastF1Lap[]>('/laps', {
    year: ref.year,
    round: ref.round,
    session: ref.session,
    driver,
  })
}

export function fetchFastF1Telemetry(ref: FastF1SessionRef, driver: string, lap?: number) {
  return f1Fetch<FastF1TelemetrySample[]>('/telemetry', {
    year: ref.year,
    round: ref.round,
    session: ref.session,
    driver,
    lap,
  })
}

export function fetchFastF1Stints(ref: FastF1SessionRef) {
  return f1Fetch<FastF1Stint[]>('/stints', {
    year: ref.year,
    round: ref.round,
    session: ref.session,
  })
}

export function fetchFastF1Weather(ref: FastF1SessionRef) {
  return f1Fetch<FastF1WeatherSample[]>('/weather', {
    year: ref.year,
    round: ref.round,
    session: ref.session,
  })
}

export function fetchFastF1RaceControl(ref: FastF1SessionRef) {
  return f1Fetch<FastF1RaceControlMessage[]>('/race_control', {
    year: ref.year,
    round: ref.round,
    session: ref.session,
  })
}

export function fetchFastF1Results(ref: FastF1SessionRef) {
  return f1Fetch<FastF1Result[]>('/results', {
    year: ref.year,
    round: ref.round,
    session: ref.session,
  })
}

// ---------------------------------------------------------------------------
// F1TV Authentication
// ---------------------------------------------------------------------------

export interface FastF1AuthStatus {
  authenticated: boolean
  email: string | null
}

export interface FastF1AuthStart {
  status: 'already_authenticated' | 'pending'
  login_url?: string
  instructions?: string
}

export async function getFastF1AuthStatus(): Promise<FastF1AuthStatus> {
  return f1Fetch<FastF1AuthStatus>('/auth/f1tv/status')
}

export async function startFastF1Auth(): Promise<FastF1AuthStart> {
  const res = await fetch(`${BASE_URL}/auth/f1tv/start`, { method: 'POST' })
  if (!res.ok) {
    const err = new Error(`FastF1 auth start failed: ${res.status}`)
    ;(err as any).status = res.status
    throw err
  }
  return res.json()
}

export async function signOutFastF1(): Promise<void> {
  await fetch(`${BASE_URL}/auth/f1tv`, { method: 'DELETE' })
}
