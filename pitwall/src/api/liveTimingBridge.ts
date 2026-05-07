const BASE_URL = 'http://127.0.0.1:7822'

export interface LiveTeamRadio {
  date: string
  driver_number: number
  recording_url: string
}

export interface LiveRadioStatus {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  count: number
}

async function ltFetch<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    const err = new Error(`LiveTiming bridge ${res.status}: ${path} — ${detail}`)
    ;(err as any).status = res.status
    throw err
  }
  return res.json()
}

export function fetchLiveTeamRadio(driverNumber?: number) {
  return ltFetch<LiveTeamRadio[]>(
    '/team_radio',
    driverNumber !== undefined ? { driver_number: driverNumber } : {},
  )
}

export function fetchLiveRadioStatus() {
  return ltFetch<LiveRadioStatus>('/team_radio/status')
}
