const BASE = 'https://api.jolpi.ca/ergast/f1'

function jolpicaError(label: string, status: number): Error {
  const err = new Error(`Jolpica ${label}: ${status}`)
  ;(err as any).status = status
  return err
}

export interface JolpicaDriverStanding {
  position: string
  points: string
  wins: string
  Driver: {
    driverId: string
    permanentNumber: string
    code: string
    givenName: string
    familyName: string
    nationality: string
  }
  Constructors: Array<{ constructorId: string; name: string }>
}

export interface JolpicaRaceResult {
  number: string
  position: string
  positionText: string
  points: string
  Driver: { driverId: string; permanentNumber: string }
}

export interface JolpicaRace {
  season: string
  round: string
  raceName: string
  Circuit: {
    circuitId: string
    Location: { country: string }
  }
  date: string
  Results: JolpicaRaceResult[]
}

export interface JolpicaStandingsList {
  season: string
  round: string
  DriverStandings: JolpicaDriverStanding[]
}

export async function fetchJolpicaDriverStandings(year: number): Promise<JolpicaStandingsList | null> {
  const res = await fetch(`${BASE}/${year}/driverstandings.json`)
  if (!res.ok) throw jolpicaError('standings', res.status)
  const data = await res.json()
  return data?.MRData?.StandingsTable?.StandingsLists?.[0] ?? null
}

export async function fetchJolpicaRaceResults(year: number): Promise<JolpicaRace[]> {
  const res = await fetch(`${BASE}/${year}/results.json?limit=100`)
  if (!res.ok) throw jolpicaError('results', res.status)
  const data = await res.json()
  return data?.MRData?.RaceTable?.Races ?? []
}
