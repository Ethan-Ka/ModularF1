import { useQuery } from '@tanstack/react-query'
import { fetchJolpicaDriverCareer, type JolpicaCareerSeason } from '../api/jolpica'
import { fetchF1dbDriverCareer } from '../api/f1db'

const noRetry429 = (count: number, err: unknown) =>
  (err as any)?.status !== 429 && count < 2

export interface DriverCareerData {
  seasons: JolpicaCareerSeason[]
  totalWins: number
  championships: number
  seasonsRaced: number
  teams: string[]
}

async function fetchCareer(driverId: string): Promise<JolpicaCareerSeason[]> {
  // f1db is the primary source for historical career data (pre-2026).
  // Fall back to Jolpica if the driver isn't found (e.g. rookies with no history).
  const f1dbSeasons = await fetchF1dbDriverCareer(driverId).catch(() => [])
  if (f1dbSeasons.length > 0) return f1dbSeasons
  return fetchJolpicaDriverCareer(driverId)
}

export function useDriverCareer(driverId: string | null | undefined) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['career', driverId],
    queryFn: () => fetchCareer(driverId!),
    enabled: Boolean(driverId),
    staleTime: Infinity,
    retry: noRetry429,
  })

  if (!data) return { career: null, isLoading: Boolean(driverId) && isLoading, isError }

  const sorted = [...data].sort((a, b) => parseInt(b.season) - parseInt(a.season))
  const totalWins = data.reduce((sum, s) => sum + parseInt(s.wins, 10), 0)
  const championships = data.filter((s) => s.position === '1').length
  const teamsSeen = new Set<string>()
  for (const s of sorted) {
    for (const c of s.constructors) teamsSeen.add(c.name)
  }

  return {
    career: {
      seasons: sorted,
      totalWins,
      championships,
      seasonsRaced: data.length,
      teams: Array.from(teamsSeen),
    } satisfies DriverCareerData,
    isLoading: false,
    isError,
  }
}
