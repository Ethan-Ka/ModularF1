export type AmbientPalette = {
  primary: string
  secondary: string
  wave: string[]
}

export type SeasonAmbientPalettes = {
  season: number
  tracks: Record<string, AmbientPalette>
  trackAliases?: Record<string, string>
  countries: Record<string, AmbientPalette>
  countryAliases?: Record<string, string>
}

const paletteCache = new Map<number, Promise<SeasonAmbientPalettes | null>>()

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const key = (value ?? '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(key)) return key
  return null
}

function findAliasTarget(
  aliases: Record<string, string> | undefined,
  key: string,
  options?: { allowIncludes?: boolean }
): string | null {
  if (!aliases || !key) return null
  const exact = aliases[key]
  if (exact) return exact

  if (!options?.allowIncludes) return null

  const sorted = Object.keys(aliases).sort((a, b) => b.length - a.length)
  for (const alias of sorted) {
    if (key.includes(alias)) return aliases[alias]
  }

  return null
}

export async function loadSeasonAmbientPalettes(year: number): Promise<SeasonAmbientPalettes | null> {
  if (!Number.isFinite(year) || year <= 0) return null
  if (paletteCache.has(year)) return paletteCache.get(year)!

  const request = fetch(`/seasons/${year}/ambient/palettes.json`)
    .then(async (res) => {
      if (!res.ok) return null
      const json = (await res.json()) as SeasonAmbientPalettes
      if (!json || typeof json !== 'object') return null
      if (!json.tracks || !json.countries) return null
      return json
    })
    .catch(() => null)

  paletteCache.set(year, request)
  return request
}

export function resolveTrackPalette(
  palettes: SeasonAmbientPalettes | null,
  circuitName: string | null,
  countryName: string | null
): AmbientPalette | null {
  if (!palettes) return null

  const circuit = normalizeKey(circuitName)
  const country = normalizeKey(countryName)

  if (circuit) {
    if (palettes.tracks[circuit]) return palettes.tracks[circuit]

    const aliasTarget = findAliasTarget(palettes.trackAliases, circuit, { allowIncludes: true })
    if (aliasTarget && palettes.tracks[aliasTarget]) return palettes.tracks[aliasTarget]
  }

  if (country) {
    const codeFromAlias = findAliasTarget(palettes.countryAliases, country, { allowIncludes: true })
    if (codeFromAlias && palettes.countries[codeFromAlias]) return palettes.countries[codeFromAlias]
  }

  return null
}

export function resolveCountryPalette(
  palettes: SeasonAmbientPalettes | null,
  countryCode: string | null,
  countryName: string | null
): AmbientPalette | null {
  if (!palettes) return null

  const normalizedCode = normalizeCountryCode(countryCode)
  if (normalizedCode && palettes.countries[normalizedCode]) {
    return palettes.countries[normalizedCode]
  }

  const country = normalizeKey(countryName)
  if (!country) return null

  const codeFromAlias = findAliasTarget(palettes.countryAliases, country, { allowIncludes: true })
  if (codeFromAlias && palettes.countries[codeFromAlias]) return palettes.countries[codeFromAlias]

  return null
}
