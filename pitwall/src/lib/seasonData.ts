import type { OpenF1Driver } from '../api/openf1'

interface SeasonManifest {
  season: number
  version: number
  drivers?: Array<{
    number: number
    code: string
    name: string
    team: string
    nationality?: string
    countryCode?: string
    numberTextColor?: string
    numberOutlineColor?: string
  }>
  assets?: {
    drivers?: string
    driverGrid?: string
    teamDirectory?: string
    teamColors?: string
    driverNumberSvgs?: string
  }
}

interface SeasonCatalog {
  defaultSeason?: number
  seasons?: SeasonCatalogEntry[]
}

export interface SeasonCatalogEntry {
  year: number
  label?: string
  status?: 'ready' | 'draft'
}

interface SeasonDriver {
  number: number
  code: string
  ref?: string
  name: string
  team: string
  nationality?: string
  countryCode?: string
  headshot?: string
  flag?: string
  numberSvg?: string
  numberTextColor?: string
  numberOutlineColor?: string
}

interface SeasonTeam {
  id: string
  name?: string
  shortName?: string
  logo?: string
}

type TeamColorMap = Record<string, { primary: string }>

export interface LoadedSeasonDrivers {
  year: number
  drivers: OpenF1Driver[]
  teamLogosByDriverNumber: Record<number, string>
}

function toSeasonAssetPath(year: number, path: string | undefined): string | null {
  if (!path) return null
  if (path.startsWith('/')) return path
  return `/seasons/${year}/${path}`
}

function trimHash(color: string | undefined): string {
  if (!color) return '6B6B70'
  return color.replace(/^#/, '')
}

const NATIONALITY_TO_COUNTRY_CODE: Record<string, string> = {
  argentine: 'AR',
  australian: 'AU',
  brazilian: 'BR',
  british: 'GB',
  canadian: 'CA',
  dutch: 'NL',
  finnish: 'FI',
  french: 'FR',
  german: 'DE',
  italian: 'IT',
  monegasque: 'MC',
  mexican: 'MX',
  new_zealander: 'NZ',
  'new zealander': 'NZ',
  spanish: 'ES',
  thai: 'TH',
}

function toCountryCode(input: string | undefined): string | undefined {
  if (!input) return undefined
  const normalized = input.trim()
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase()

  const key = normalized.toLowerCase()
  return NATIONALITY_TO_COUNTRY_CODE[key]
}

function toTeamDisplayName(teamId: string, teamById: Map<string, SeasonTeam>): string {
  const team = teamById.get(teamId)
  if (team?.shortName) return team.shortName
  if (team?.name) return team.name
  return teamId
    .split('_')
    .map((chunk) => chunk.slice(0, 1).toUpperCase() + chunk.slice(1))
    .join(' ')
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Failed to load season asset: ${path} (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function loadSeasonDrivers(year: number): Promise<LoadedSeasonDrivers> {
  const basePath = `/seasons/${year}`
  const manifest = await fetchJson<SeasonManifest>(`${basePath}/manifest.json`)

  const [driverGrid, teamColors, teams] = await Promise.all([
    manifest.assets?.driverGrid
      ? fetchJson<SeasonDriver[]>(`${basePath}/${manifest.assets.driverGrid}`)
      : Promise.resolve(manifest.drivers ?? []),
    manifest.assets?.teamColors
      ? fetchJson<TeamColorMap>(`${basePath}/${manifest.assets.teamColors}`)
      : Promise.resolve({}),
    manifest.assets?.teamDirectory
      ? fetchJson<SeasonTeam[]>(`${basePath}/${manifest.assets.teamDirectory}`).catch(() => [])
      : Promise.resolve([]),
  ])

  const teamById = new Map(teams.map((team) => [team.id, team]))
  const driverHeadshotBasePath = toSeasonAssetPath(year, manifest.assets?.drivers) ?? `${basePath}/drivers/headshots`

  const drivers: OpenF1Driver[] = [...driverGrid]
    .sort((a, b) => a.number - b.number)
    .map((driver) => ({
      driver_number: driver.number,
      name_acronym: driver.code,
      full_name: driver.name,
      team_name: toTeamDisplayName(driver.team, teamById),
      team_colour: trimHash(teamColors[driver.team]?.primary),
      nationality: driver.nationality,
      country_code: toCountryCode(driver.countryCode ?? driver.nationality),
      headshot_url: driver.headshot
        ? toSeasonAssetPath(year, driver.headshot) ?? undefined
        : driver.ref
          ? `${driverHeadshotBasePath}/${driver.ref}.png`
          : undefined,
      flag_url: driver.flag ? toSeasonAssetPath(year, driver.flag) ?? undefined : undefined,
      number_svg_url: driver.numberSvg ? toSeasonAssetPath(year, driver.numberSvg) ?? undefined : undefined,
      number_text_color: driver.numberTextColor,
      number_outline_color: driver.numberOutlineColor,
      session_key: year,
    }))

  const teamLogoByTeamId = new Map(
    teams
      .map((team) => [team.id, toSeasonAssetPath(year, team.logo)] as const)
      .filter(([, logoPath]) => !!logoPath)
  )

  const teamLogosByDriverNumber: Record<number, string> = {}
  for (const driver of driverGrid) {
    const logoPath = teamLogoByTeamId.get(driver.team)
    if (!logoPath) continue
    teamLogosByDriverNumber[driver.number] = logoPath
  }

  return {
    year: manifest.season,
    drivers,
    teamLogosByDriverNumber,
  }
}

export async function loadSeasonCatalog(): Promise<SeasonCatalogEntry[]> {
  try {
    const catalog = await fetchJson<SeasonCatalog>('/seasons/index.json')
    const list = catalog.seasons ?? []
    return list.filter((entry) => Number.isFinite(entry.year)).sort((a, b) => b.year - a.year)
  } catch {
    // Fallback for older bundles that do not include a root season catalog.
    return [{ year: 2026, label: '2026 (bundle)', status: 'ready' }]
  }
}
