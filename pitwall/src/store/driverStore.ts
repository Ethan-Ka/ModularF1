import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpenF1Driver } from '../api/openf1'
import { loadSeasonDrivers } from '../lib/seasonData'

export type WindowFocusSelector = 'FOCUS' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'GAP+1' | 'GAP-1'

interface DriverStore {
  drivers: OpenF1Driver[]
  starred: number[]           // driver_numbers
  canvasFocus: number | null  // driver_number of canvas focus driver
  windowFocusSelector: WindowFocusSelector
  seasonYear: number | null
  teamColors: Record<number, string> // driver_number → hex color
  teamColorOverrides: Record<string, string> // normalized team_name -> hex color
  teamLogos: Record<number, string> // driver_number -> season logo path
  setDrivers: (
    drivers: OpenF1Driver[],
    options?: { seasonYear?: number | null; teamLogos?: Record<number, string> }
  ) => void
  importSeasonFromPublic: (year: number) => Promise<{ count: number; year: number }>
  applySeasonVisualsFromPublic: (year: number) => Promise<{ updated: number; year: number }>
  toggleStar: (driverNumber: number) => void
  setCanvasFocus: (driverNumber: number | null) => void
  setWindowFocusSelector: (selector: WindowFocusSelector) => void
  setTeamColorForTeam: (teamName: string, color: string) => void
  clearTeamColorForTeam: (teamName: string) => void
  getDriver: (driverNumber: number) => OpenF1Driver | undefined
  getTeamColor: (driverNumber: number) => string
  getTeamLogo: (driverNumber: number) => string | null
}

function normalizeTeamKey(teamName: string): string {
  return teamName.trim().toLowerCase()
}

function normalizeHexColor(color: string): string {
  const cleaned = color.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return '#6B6B70'
  return `#${cleaned.toUpperCase()}`
}

function buildTeamColors(
  drivers: OpenF1Driver[],
  overrides: Record<string, string>
): Record<number, string> {
  const teamColors: Record<number, string> = {}
  for (const d of drivers) {
    const teamKey = normalizeTeamKey(d.team_name)
    const override = overrides[teamKey]
    if (override) {
      teamColors[d.driver_number] = override
      continue
    }

    const normalized = d.team_colour.replace(/^#/, '')
    teamColors[d.driver_number] = `#${normalized}`
  }
  return teamColors
}

export const useDriverStore = create<DriverStore>()(
  persist(
    (set, get) => ({
      drivers: [],
      starred: [],
      canvasFocus: null,
      windowFocusSelector: 'FOCUS',
      seasonYear: null,
      teamColors: {},
      teamColorOverrides: {},
      teamLogos: {},

      setDrivers: (drivers, options) => {
        const seasonYear = options?.seasonYear ?? null
        const teamColors = buildTeamColors(drivers, get().teamColorOverrides)
        set({
          drivers,
          teamColors,
          seasonYear,
          teamLogos: options?.teamLogos ?? {},
        })
      },

      importSeasonFromPublic: async (year) => {
        const loaded = await loadSeasonDrivers(year)
        get().setDrivers(loaded.drivers, {
          seasonYear: loaded.year,
          teamLogos: loaded.teamLogosByDriverNumber,
        })
        return { count: loaded.drivers.length, year: loaded.year }
      },

      applySeasonVisualsFromPublic: async (year) => {
        const loaded = await loadSeasonDrivers(year)
        const currentDrivers = get().drivers

        if (currentDrivers.length === 0) {
          get().setDrivers(loaded.drivers, {
            seasonYear: loaded.year,
            teamLogos: loaded.teamLogosByDriverNumber,
          })
          return { updated: loaded.drivers.length, year: loaded.year }
        }

        const byNumber = new Map(
          loaded.drivers.map((driver) => [driver.driver_number, driver] as const)
        )

        let updated = 0
        const mergedDrivers = currentDrivers.map((driver) => {
          const visual = byNumber.get(driver.driver_number)
          if (!visual) return driver

          const nextDriver = {
            ...driver,
            team_colour: visual.team_colour,
            team_name: visual.team_name,
            nationality: visual.nationality ?? driver.nationality,
            country_code: visual.country_code ?? driver.country_code,
            headshot_url: visual.headshot_url ?? driver.headshot_url,
            flag_url: visual.flag_url ?? driver.flag_url,
            number_svg_url: visual.number_svg_url ?? driver.number_svg_url,
            number_text_color: visual.number_text_color ?? driver.number_text_color,
            number_outline_color: visual.number_outline_color ?? driver.number_outline_color,
          }

          if (
            nextDriver.team_colour !== driver.team_colour
            || nextDriver.team_name !== driver.team_name
            || nextDriver.nationality !== driver.nationality
            || nextDriver.country_code !== driver.country_code
            || nextDriver.headshot_url !== driver.headshot_url
            || nextDriver.flag_url !== driver.flag_url
            || nextDriver.number_svg_url !== driver.number_svg_url
            || nextDriver.number_text_color !== driver.number_text_color
            || nextDriver.number_outline_color !== driver.number_outline_color
          ) {
            updated += 1
          }

          return nextDriver
        })

        get().setDrivers(mergedDrivers, {
          seasonYear: loaded.year,
          teamLogos: loaded.teamLogosByDriverNumber,
        })

        return { updated, year: loaded.year }
      },

      toggleStar: (driverNumber) => {
        const { starred } = get()
        if (starred.includes(driverNumber)) {
          set({ starred: starred.filter((n) => n !== driverNumber) })
        } else {
          set({ starred: [...starred, driverNumber] })
        }
      },

      setCanvasFocus: (driverNumber) => set({ canvasFocus: driverNumber }),

      setWindowFocusSelector: (selector) => set({ windowFocusSelector: selector }),

      setTeamColorForTeam: (teamName, color) => {
        const teamKey = normalizeTeamKey(teamName)
        const normalizedColor = normalizeHexColor(color)
        const state = get()
        const nextOverrides = {
          ...state.teamColorOverrides,
          [teamKey]: normalizedColor,
        }
        set({
          teamColorOverrides: nextOverrides,
          teamColors: buildTeamColors(state.drivers, nextOverrides),
        })
      },

      clearTeamColorForTeam: (teamName) => {
        const teamKey = normalizeTeamKey(teamName)
        const state = get()
        if (!(teamKey in state.teamColorOverrides)) return
        const { [teamKey]: _removed, ...remainingOverrides } = state.teamColorOverrides
        set({
          teamColorOverrides: remainingOverrides,
          teamColors: buildTeamColors(state.drivers, remainingOverrides),
        })
      },

      getDriver: (driverNumber) => get().drivers.find((d) => d.driver_number === driverNumber),

      getTeamColor: (driverNumber) => {
        const color = get().teamColors[driverNumber]
        return color ?? '#6B6B70'
      },

      getTeamLogo: (driverNumber) => {
        return get().teamLogos[driverNumber] ?? null
      },
    }),
    {
      name: 'pitwall-drivers',
      partialize: (s) => ({
        starred: s.starred,
        canvasFocus: s.canvasFocus,
        windowFocusSelector: s.windowFocusSelector,
        teamColorOverrides: s.teamColorOverrides,
      }),
    }
  )
)
