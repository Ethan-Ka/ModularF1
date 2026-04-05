export type TeamPalette = {
  primary: string
  secondary?: string
}

const TEAM_PALETTES: Record<string, TeamPalette> = {
  ferrari: { primary: '#E8002D', secondary: '#F6C343' },
  mclaren: { primary: '#FF8000', secondary: '#63C5FF' },
  red_bull: { primary: '#3671C6', secondary: '#E8132B' },
  mercedes: { primary: '#00A0DD', secondary: '#6DE5E9' },
  aston_martin: { primary: '#1AACB8', secondary: '#87F2CF' },
  alpine: { primary: '#52E252', secondary: '#0078FF' },
  rb: { primary: '#C92D4B', secondary: '#6C7BFF' },
  williams: { primary: '#64C4FF', secondary: '#1A5BBE' },
  haas: { primary: '#B6BABD', secondary: '#E10600' },
  kick_sauber: { primary: '#00E701', secondary: '#0D5C2D' },
}

function normalizeTeamName(teamName: string): string {
  return teamName.trim().toLowerCase().replace(/[-\s]+/g, ' ')
}

export function resolveTeamPalette(teamName: string | null, fallback: string | null): TeamPalette | null {
  if (teamName) {
    const n = normalizeTeamName(teamName)

    if (n.includes('ferrari')) return TEAM_PALETTES.ferrari
    if (n.includes('mclaren')) return TEAM_PALETTES.mclaren
    if (n.includes('red bull')) return TEAM_PALETTES.red_bull
    if (n.includes('mercedes')) return TEAM_PALETTES.mercedes
    if (n.includes('aston')) return TEAM_PALETTES.aston_martin
    if (n.includes('alpine')) return TEAM_PALETTES.alpine
    if (n.includes('racing bulls') || n === 'rb' || n.includes('visa cash app rb')) return TEAM_PALETTES.rb
    if (n.includes('williams')) return TEAM_PALETTES.williams
    if (n.includes('haas')) return TEAM_PALETTES.haas
    if (n.includes('sauber') || n.includes('kick') || n.includes('stake')) return TEAM_PALETTES.kick_sauber
  }

  if (fallback) return { primary: fallback }
  return null
}
