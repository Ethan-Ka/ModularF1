import type { OpenF1Driver } from '../api/openf1'
import type { WindowFocusSelector } from '../store/driverStore'
import type { CanvasTab } from '../store/workspaceStore'

export const PITWALL_EXTENSION = '.pitwall'

export type PitwallFileKind = 'settings' | 'season' | 'workspace' | 'bundle'

export interface SettingsSnapshot {
  session: {
    apiKey: string | null
    mode: 'live' | 'historical' | 'onboarding'
    apiRequestsEnabled: boolean
  }
  ambient: {
    leaderColorMode: boolean
    ambientLayerEnabled: boolean
    ambientLayerIntensity: number
    ambientLayerWaveEnabled: boolean
  }
  driver: {
    starred: number[]
    canvasFocus: number | null
    windowFocusSelector: WindowFocusSelector
  }
}

export interface SeasonSnapshot {
  seasonYear: number | null
  drivers: OpenF1Driver[]
  teamColors: Record<number, string>
  teamColorOverrides?: Record<string, string>
  teamLogos: Record<number, string>
}

export interface WorkspaceSnapshot {
  activeTabId: string
  tabs: CanvasTab[]
}

export interface BundleSnapshot {
  settings: SettingsSnapshot
  season: SeasonSnapshot
  workspace: WorkspaceSnapshot
}

interface PitwallEnvelopeBase<TKind extends PitwallFileKind, TPayload> {
  format: 'pitwall'
  version: 1
  app: 'pitwall'
  kind: TKind
  createdAt: string
  payload: TPayload
}

export type PitwallEnvelope =
  | PitwallEnvelopeBase<'settings', SettingsSnapshot>
  | PitwallEnvelopeBase<'season', SeasonSnapshot>
  | PitwallEnvelopeBase<'workspace', WorkspaceSnapshot>
  | PitwallEnvelopeBase<'bundle', BundleSnapshot>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPitwallKind(kind: unknown): kind is PitwallFileKind {
  return kind === 'settings' || kind === 'season' || kind === 'workspace' || kind === 'bundle'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isWindowFocusSelector(value: unknown): value is WindowFocusSelector {
  return (
    value === 'FOCUS'
    || value === 'P1'
    || value === 'P2'
    || value === 'P3'
    || value === 'P4'
    || value === 'P5'
    || value === 'GAP+1'
    || value === 'GAP-1'
  )
}

function hasValidEnvelopeBase(value: unknown): value is Omit<PitwallEnvelopeBase<PitwallFileKind, unknown>, 'payload'> {
  if (!isObject(value)) return false
  return (
    value.format === 'pitwall'
    && value.version === 1
    && value.app === 'pitwall'
    && isPitwallKind(value.kind)
    && typeof value.createdAt === 'string'
  )
}

function hasSettingsSnapshot(value: unknown): value is SettingsSnapshot {
  if (!isObject(value)) return false
  if (!isObject(value.session) || !isObject(value.ambient) || !isObject(value.driver)) return false

  const sessionMode = value.session.mode
  const isMode = sessionMode === 'live' || sessionMode === 'historical' || sessionMode === 'onboarding'
  if (!isMode) return false
  if (value.session.apiKey !== null && typeof value.session.apiKey !== 'string') return false
  if (typeof value.session.apiRequestsEnabled !== 'boolean') return false

  if (typeof value.ambient.leaderColorMode !== 'boolean') return false
  if (typeof value.ambient.ambientLayerEnabled !== 'boolean') return false
  if (typeof value.ambient.ambientLayerIntensity !== 'number') return false
  if (typeof value.ambient.ambientLayerWaveEnabled !== 'boolean') return false

  if (!Array.isArray(value.driver.starred) || !value.driver.starred.every((n) => typeof n === 'number')) return false
  if (value.driver.canvasFocus !== null && typeof value.driver.canvasFocus !== 'number') return false
  if (!isWindowFocusSelector(value.driver.windowFocusSelector)) return false

  return true
}

function hasSeasonSnapshot(value: unknown): value is SeasonSnapshot {
  if (!isObject(value)) return false
  if (value.seasonYear !== null && typeof value.seasonYear !== 'number') return false
  if (!Array.isArray(value.drivers)) return false
  if (!isObject(value.teamColors) || !isObject(value.teamLogos)) return false
  if (
    'teamColorOverrides' in value
    && value.teamColorOverrides !== undefined
    && !isObject(value.teamColorOverrides)
  ) return false
  return true
}

function hasWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!isObject(value)) return false
  if (typeof value.activeTabId !== 'string') return false
  if (!Array.isArray(value.tabs)) return false
  if (
    !value.tabs.every((tab) => (
      isObject(tab)
      && typeof tab.id === 'string'
      && typeof tab.name === 'string'
      && Array.isArray(tab.layout)
      && isObject(tab.widgets)
    ))
  ) return false
  return true
}

function hasBundleSnapshot(value: unknown): value is BundleSnapshot {
  if (!isObject(value)) return false
  return (
    hasSettingsSnapshot(value.settings)
    && hasSeasonSnapshot(value.season)
    && hasWorkspaceSnapshot(value.workspace)
  )
}

export function stringifyPitwallFile(envelope: PitwallEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function parsePitwallFile(contents: string): PitwallEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error('Invalid JSON in .pitwall file.')
  }

  if (!hasValidEnvelopeBase(parsed) || !isObject(parsed)) {
    throw new Error('Invalid .pitwall file envelope.')
  }

  if (!('payload' in parsed)) {
    throw new Error('Missing .pitwall payload.')
  }

  const { kind, payload } = parsed

  if (kind === 'settings' && hasSettingsSnapshot(payload)) return parsed as PitwallEnvelope
  if (kind === 'season' && hasSeasonSnapshot(payload)) return parsed as PitwallEnvelope
  if (kind === 'workspace' && hasWorkspaceSnapshot(payload)) return parsed as PitwallEnvelope
  if (kind === 'bundle' && hasBundleSnapshot(payload)) return parsed as PitwallEnvelope

  throw new Error(`Invalid payload for kind "${kind}".`)
}

export function createPitwallEnvelope(kind: 'settings', payload: SettingsSnapshot): PitwallEnvelope
export function createPitwallEnvelope(kind: 'season', payload: SeasonSnapshot): PitwallEnvelope
export function createPitwallEnvelope(kind: 'workspace', payload: WorkspaceSnapshot): PitwallEnvelope
export function createPitwallEnvelope(kind: 'bundle', payload: BundleSnapshot): PitwallEnvelope
export function createPitwallEnvelope(kind: PitwallFileKind, payload: SettingsSnapshot | SeasonSnapshot | WorkspaceSnapshot | BundleSnapshot): PitwallEnvelope {
  return {
    format: 'pitwall',
    version: 1,
    app: 'pitwall',
    kind,
    createdAt: new Date().toISOString(),
    payload,
  } as PitwallEnvelope
}

export function normalizePitwallBaseName(name: string): string {
  const trimmed = name.trim().toLowerCase()
  const cleaned = trimmed
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')

  return cleaned || 'pitwall-export'
}

export function makePitwallFileName(baseName: string, kind: PitwallFileKind): string {
  return `${normalizePitwallBaseName(baseName)}.${kind}${PITWALL_EXTENSION}`
}

export function maybePitwallFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(PITWALL_EXTENSION)
}

export function describePitwallImportKinds(kinds: PitwallFileKind[]): string {
  const uniqueKinds = Array.from(new Set(kinds))
  return isStringArray(uniqueKinds) ? uniqueKinds.join(', ') : ''
}
