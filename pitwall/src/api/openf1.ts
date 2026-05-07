// OpenF1 API typed wrappers
// Base URL: https://api.openf1.org/v1/
// Currently used only for team radio + session metadata mapping.

import { useAmbientStore } from '../store/ambientStore'
import { useSessionStore } from '../store/sessionStore'

const BASE_URL = 'https://api.openf1.org/v1'
const RATE_LIMIT_TOAST_COOLDOWN_MS = 15_000
let lastRateLimitToastAt = 0

function notifyRateLimitToast() {
  const now = Date.now()
  if (now - lastRateLimitToastAt < RATE_LIMIT_TOAST_COOLDOWN_MS) return
  lastRateLimitToastAt = now
  useAmbientStore
    .getState()
    .addToast('OpenF1 rate limit reached. Requests are being throttled.', 'YELLOW')
}

export interface OpenF1Session {
  session_key: number
  session_type: string
  session_name: string
  circuit_short_name: string
  date_start: string
  date_end: string
  year: number
  country_name?: string
  circuit_key?: number
  meeting_key?: number
}

export interface OpenF1Driver {
  driver_number: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
  nationality?: string
  country_code?: string
  headshot_url?: string
  flag_url?: string
  number_svg_url?: string
  number_text_color?: string
  number_outline_color?: string
  session_key: number
}

export interface OpenF1Lap {
  driver_number: number
  lap_number: number
  lap_duration: number | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  is_pit_out_lap: boolean
  date_start: string
  session_key: number
}

export interface OpenF1Interval {
  driver_number: number
  gap_to_leader: number | null
  interval: number | null
  date: string
  session_key: number
}

export interface OpenF1Position {
  driver_number: number
  position: number
  date: string
  session_key: number
}

export interface OpenF1Weather {
  air_temperature: number
  track_temperature: number
  humidity: number
  wind_speed: number
  wind_direction: number
  rainfall: number
  pressure: number
  date: string
  session_key: number
}

export interface OpenF1RaceControl {
  flag: string | null
  message: string
  category: string
  driver_number: number | null
  date: string
  session_key: number
  scope?: string
  sector?: number | null
  lap_number?: number | null
}

export interface OpenF1Stint {
  driver_number: number
  stint_number: number
  compound: string
  tyre_age_at_start: number
  lap_start: number
  lap_end: number | null
  session_key: number
}

export interface OpenF1Location {
  driver_number: number
  x: number
  y: number
  z: number
  date: string
  session_key: number
}

export interface OpenF1CarData {
  driver_number: number
  speed: number
  throttle: number
  brake: number
  rpm: number
  n_gear: number
  drs: number
  date: string
  session_key: number
}

export interface OpenF1Meeting {
  meeting_key: number
  meeting_name: string
  circuit_short_name: string
  country_name: string
  date_start: string
  year: number
}

// Low-level fetch with optional auth
async function openf1Fetch<T>(
  path: string,
  params: Record<string, string | number | undefined | 'latest'> = {},
  apiKey?: string
): Promise<T[]> {
  if (!useSessionStore.getState().apiRequestsEnabled) {
    const err = new Error(`OpenF1 request blocked by developer toggle: ${path}`)
    ;(err as any).status = 499
    throw err
  }

  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    if (res.status === 429) notifyRateLimitToast()
    const err = new Error(`OpenF1 ${res.status}: ${path}`)
    ;(err as any).status = res.status
    throw err
  }
  return res.json()
}

export async function validateApiKey(
  apiKey: string
): Promise<'valid' | 'invalid' | 'forbidden' | 'rate_limited' | 'network_error'> {
  try {
    const url = `${BASE_URL}/sessions?year=2024&session_name=Race`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (res.ok) return 'valid'
    if (res.status === 401) return 'invalid'
    if (res.status === 403) return 'forbidden'
    if (res.status === 429) return 'rate_limited'
    return 'network_error'
  } catch {
    return 'network_error'
  }
}

// --- Sessions (used for team radio session-key mapping) ---
export function fetchSessions(params?: { year?: number }, apiKey?: string) {
  return openf1Fetch<OpenF1Session>('/sessions', params ?? {}, apiKey)
}

// --- Team Radio ---
export interface OpenF1TeamRadio {
  date: string
  driver_number: number
  meeting_key: number
  recording_url: string
  session_key: number
}

export function fetchTeamRadio(sessionKey: number, driverNumber?: number, apiKey?: string) {
  return openf1Fetch<OpenF1TeamRadio>('/team_radio', { session_key: sessionKey, driver_number: driverNumber }, apiKey)
}
