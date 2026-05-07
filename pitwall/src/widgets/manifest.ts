import type { ComponentType } from 'react'
import { LapDeltaTower, HELP as LapDeltaTower_HELP } from './LapDeltaTower'
import { RunningOrderStrip, HELP as RunningOrderStrip_HELP } from './RunningOrderStrip'
import { RaceControlFeed, HELP as RaceControlFeed_HELP } from './RaceControlFeed'
import { WeatherDashboard, HELP as WeatherDashboard_HELP } from './WeatherDashboard'
import { TyreIntelligence, HELP as TyreIntelligence_HELP } from './TyreIntelligence'
import { FullTrackMap, HELP as FullTrackMap_HELP } from './FullTrackMap'
import { WeatherRadar, HELP as WeatherRadar_HELP } from './WeatherRadar'
import { StandingsBoard, HELP as StandingsBoard_HELP } from './StandingsBoard'
import { LiveLapTimeCard, HELP as LiveLapTimeCard_HELP } from './LiveLapTimeCard'
import { LastLapCard, HELP as LastLapCard_HELP } from './LastLapCard'
import { StintPaceComparison, HELP as StintPaceComparison_HELP } from './StintPaceComparison'
import { SectorMiniCards, HELP as SectorMiniCards_HELP } from './SectorMiniCards'
import { GapEvolutionChart, HELP as GapEvolutionChart_HELP } from './GapEvolutionChart'
import { TrackTempEvolution, HELP as TrackTempEvolution_HELP } from './TrackTempEvolution'
import { RadioScanner, HELP as RadioScanner_HELP } from './RadioScanner'
import { RadioFeedText, HELP as RadioFeedText_HELP } from './RadioFeedText'
import { SpeedGauge, HELP as SpeedGauge_HELP } from './SpeedGauge'
import { ERSMicroSectors, HELP as ERSMicroSectors_HELP } from './ERSMicroSectors'
import { DRSEfficiency, HELP as DRSEfficiency_HELP } from './DRSEfficiency'
import { EngineModeTracker, HELP as EngineModeTracker_HELP } from './EngineModeTracker'
import { HeadToHeadDelta, HELP as HeadToHeadDelta_HELP } from './HeadToHeadDelta'
import { ThrottleBrakeTrace, HELP as ThrottleBrakeTrace_HELP } from './ThrottleBrakeTrace'
import { GearTrace, HELP as GearTrace_HELP } from './GearTrace'
import { ThrottleHeatmap, HELP as ThrottleHeatmap_HELP } from './ThrottleHeatmap'
import { StrategyTimeline, HELP as StrategyTimeline_HELP } from './StrategyTimeline'
import { DegRateGraph, HELP as DegRateGraph_HELP } from './DegRateGraph'
import { PitWindowUrgency, HELP as PitWindowUrgency_HELP } from './PitWindowUrgency'
import { PitStopLog, HELP as PitStopLog_HELP } from './PitStopLog'
import { UndercutSimulator, HELP as UndercutSimulator_HELP } from './UndercutSimulator'
import { SectorMap, HELP as SectorMap_HELP } from './SectorMap'
import { OvertakeReplay, HELP as OvertakeReplay_HELP } from './OvertakeReplay'
import { WindDirection, HELP as WindDirection_HELP } from './WindDirection'
import { StandingsTable, HELP as StandingsTable_HELP } from './StandingsTable'
import { ChampionshipCalculator, HELP as ChampionshipCalculator_HELP } from './ChampionshipCalculator'
import { PointsDeltaTracker, HELP as PointsDeltaTracker_HELP } from './PointsDeltaTracker'
import { CarVisualization, HELP as CarVisualization_HELP } from './CarVisualization'

export type WidgetCategory =
  | 'Timing'
  | 'Telemetry'
  | 'Race Control'
  | 'Strategy'
  | 'Weather'
  | 'Track'
  | 'Radio'
  | 'Standings'

export interface WidgetManifestEntry {
  type: string
  label: string
  description: string
  /** Optional richer markdown help content (preferred) */
  help?: string
  category: WidgetCategory
  color: string
  defaultSize: { w: number; h: number }
  minH: number
  minW?: number
  /** When false, minH is respected as-is. When true (default), minH is auto-set to defaultSize.h so all content stays visible. */
  fitContent?: boolean
  component: ComponentType<{ widgetId: string }>
}

export const WIDGET_MANIFEST: WidgetManifestEntry[] = [
  {
    type: 'LapDeltaTower',
    label: 'Lap Delta Tower',
    description: 'Full ranking table with gap, interval, sector times',
    help: LapDeltaTower_HELP,
    category: 'Timing',
    color: 'var(--red)',
    defaultSize: { w: 12, h: 10 },
    minH: 6,
    fitContent: false,
    component: LapDeltaTower,
  },
  {
    type: 'LastLapCard',
    label: 'Last Lap Card',
    description: 'Shows the last completed lap for a driver (no live timer)',
    help: LastLapCard_HELP,
    category: 'Timing',
    color: 'var(--red)',
    defaultSize: { w: 4, h: 4 },
    minH: 3,
    component: LastLapCard,
  },
  {
    type: 'LiveLapTimeCard',
    label: 'Lap Time Card',
    description: 'Shows the live running lap timer for the focused driver (no completed lap fallback)',
    help: LiveLapTimeCard_HELP,
    category: 'Timing',
    color: 'var(--red)',
    defaultSize: { w: 4, h: 3 },
    minH: 2,
    component: LiveLapTimeCard,
  },
  {
    type: 'GapEvolutionChart',
    label: 'Gap Evolution Chart',
    description: 'Gap history chart between two selected drivers',
    help: GapEvolutionChart_HELP,
    category: 'Timing',
    color: 'var(--red)',
    defaultSize: { w: 8, h: 7 },
    minH: 6,
    component: GapEvolutionChart,
  },
  {
    type: 'HeadToHeadDelta',
    label: 'Head-to-Head Delta',
    description: 'Direct comparison card for two driver targets',
    help: HeadToHeadDelta_HELP,
    category: 'Timing',
    color: 'var(--red)',
    defaultSize: { w: 8, h: 4 },
    minH: 3,
    component: HeadToHeadDelta,
  },
  {
    type: 'SectorMiniCards',
    label: 'Sector Mini-Cards',
    description: 'Compact S1/S2/S3 performance cards',
    help: SectorMiniCards_HELP,
    category: 'Timing',
    color: 'var(--red)',
    defaultSize: { w: 4, h: 5 },
    minH: 3,
    component: SectorMiniCards,
  },
  {
    type: 'SpeedGauge',
    label: 'Speed Gauge',
    description: 'Live speed telemetry with gear/rpm view',
    help: SpeedGauge_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 4, h: 4 },
    minH: 3,
    component: SpeedGauge,
  },
  {
    type: 'ThrottleBrakeTrace',
    label: 'Throttle / Brake Trace',
    description: 'Pedal input timeline for focused driver',
    help: ThrottleBrakeTrace_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 8, h: 4 },
    minH: 4,
    component: ThrottleBrakeTrace,
  },
  {
    type: 'GearTrace',
    label: 'Gear Trace',
    description: 'Rolling gear selection trace over time',
    help: GearTrace_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 8, h: 5 },
    minH: 3,
    component: GearTrace,
  },
  {
    type: 'ThrottleHeatmap',
    label: 'Throttle Heatmap',
    description: 'Lap segment throttle intensity heatmap',
    help: ThrottleHeatmap_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    component: ThrottleHeatmap,
  },
  {
    type: 'ERSMicroSectors',
    label: 'ERS Micro-Sectors',
    description: 'Inferred ERS deployment by micro-sector',
    help: ERSMicroSectors_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 8, h: 5 },
    minH: 3,
    component: ERSMicroSectors,
  },
  {
    type: 'DRSEfficiency',
    label: 'DRS Efficiency',
    description: 'Inferred open-vs-closed DRS delta metric',
    help: DRSEfficiency_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 4, h: 4 },
    minH: 3,
    component: DRSEfficiency,
  },
  {
    type: 'EngineModeTracker',
    label: 'Engine Mode Tracker',
    description: 'Inferred power mode behavior tracker',
    help: EngineModeTracker_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 4, h: 5 },
    minH: 3,
    component: EngineModeTracker,
  },
  {
    type: 'CarVisualization',
    label: 'Car Visualization',
    description: '2026 car profile with telemetry overlays',
    help: CarVisualization_HELP,
    category: 'Telemetry',
    color: 'var(--purple)',
    defaultSize: { w: 10, h: 7 },
    minH: 3,
    minW: 10,
    component: CarVisualization,
  },
  {
    type: 'RunningOrderStrip',
    label: 'Running Order Strip',
    description: 'Horizontal dot row of all 20 drivers by position',
    help: RunningOrderStrip_HELP,
    category: 'Race Control',
    color: 'var(--orange)',
    defaultSize: { w: 24, h: 2 },
    minH: 1,
    fitContent: false,
    component: RunningOrderStrip,
  },
  {
    type: 'RaceControlFeed',
    label: 'Race Control Feed',
    description: 'Timestamped flag and incident log',
    help: RaceControlFeed_HELP,
    category: 'Race Control',
    color: 'var(--gold)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    fitContent: false,
    component: RaceControlFeed,
  },
  {
    type: 'StintPaceComparison',
    label: 'Stint Pace Comparison',
    description: 'Compares pace in a matched tyre age window',
    help: StintPaceComparison_HELP,
    category: 'Strategy',
    color: 'var(--purple)',
    defaultSize: { w: 8, h: 4 },
    minH: 3,
    component: StintPaceComparison,
  },
  {
    type: 'StrategyTimeline',
    label: 'Strategy Timeline',
    description: 'All-driver stint timeline with pit markers',
    help: StrategyTimeline_HELP,
    category: 'Strategy',
    color: 'var(--gold)',
    defaultSize: { w: 16, h: 6 },
    minH: 3,
    component: StrategyTimeline,
  },
  {
    type: 'DegRateGraph',
    label: 'Deg Rate Graph',
    description: 'Inferred tyre degradation curve by stint',
    help: DegRateGraph_HELP,
    category: 'Strategy',
    color: 'var(--gold)',
    defaultSize: { w: 8, h: 7 },
    minH: 7,
    component: DegRateGraph,
  },
  {
    type: 'PitWindowUrgency',
    label: 'Pit Window Urgency',
    description: 'Inferred urgency signal for next stop window',
    help: PitWindowUrgency_HELP,
    category: 'Strategy',
    color: 'var(--gold)',
    defaultSize: { w: 4, h: 5 },
    minH: 5,
    component: PitWindowUrgency,
  },
  {
    type: 'PitStopLog',
    label: 'Pit Stop Log',
    description: 'Chronological pit stop history list',
    help: PitStopLog_HELP,
    category: 'Strategy',
    color: 'var(--gold)',
    defaultSize: { w: 8, h: 4 },
    minH: 3,
    component: PitStopLog,
  },
  {
    type: 'UndercutSimulator',
    label: 'Undercut Simulator',
    description: 'Scenario calculator for undercut outcomes',
    help: UndercutSimulator_HELP,
    category: 'Strategy',
    color: 'var(--gold)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    component: UndercutSimulator,
  },
  {
    type: 'TyreIntelligence',
    label: 'Tyre Intelligence',
    description: 'Cliff lap prediction with editable formula ~EST',
    help: TyreIntelligence_HELP,
    category: 'Strategy',
    color: 'var(--green)',
    defaultSize: { w: 6, h: 6 },
    minH: 3,
    component: TyreIntelligence,
  },
  {
    type: 'WeatherDashboard',
    label: 'Weather Dashboard',
    description: '6 live weather metrics with trend arrows',
    help: WeatherDashboard_HELP,
    category: 'Weather',
    color: 'var(--cyan)',
    defaultSize: { w: 8, h: 5 },
    minH: 3,
    component: WeatherDashboard,
  },
  {
    type: 'TrackTempEvolution',
    label: 'Track Temp Evolution',
    description: 'Track temperature chart with inferred overlays',
    help: TrackTempEvolution_HELP,
    category: 'Weather',
    color: 'var(--blue)',
    defaultSize: { w: 8, h: 5 },
    minH: 5,
    component: TrackTempEvolution,
  },
  {
    type: 'WindDirection',
    label: 'Wind Direction',
    description: 'Wind direction and drift changes by heading',
    help: WindDirection_HELP,
    category: 'Weather',
    color: 'var(--blue)',
    defaultSize: { w: 4, h: 7 },
    minH: 7,
    component: WindDirection,
  },
  {
    type: 'WeatherRadar',
    label: 'Weather Radar',
    description: 'Windy embed centered on circuit',
    help: WeatherRadar_HELP,
    category: 'Weather',
    color: 'var(--blue)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    component: WeatherRadar,
  },
  {
    type: 'FullTrackMap',
    label: 'Full Track Map',
    description: 'Live driver positions on SVG circuit outline',
    help: FullTrackMap_HELP,
    category: 'Track',
    color: 'var(--purple)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    component: FullTrackMap,
  },
  {
    type: 'SectorMap',
    label: 'Sector Map',
    description: 'Track sectors with driver position context',
    help: SectorMap_HELP,
    category: 'Track',
    color: 'var(--green)',
    defaultSize: { w: 9, h: 11 },
    minH: 3,
    component: SectorMap,
  },
  {
    type: 'OvertakeReplay',
    label: 'Overtake Replay',
    description: 'Historic overtake events and replay timeline',
    help: OvertakeReplay_HELP,
    category: 'Track',
    color: 'var(--green)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    component: OvertakeReplay,
  },
  {
    type: 'RadioScanner',
    label: 'Radio Scanner',
    description: 'Live team radio channel scanner',
    help: RadioScanner_HELP,
    category: 'Radio',
    color: 'var(--pink)',
    defaultSize: { w: 8, h: 8 },
    minH: 3,
    fitContent: false,
    component: RadioScanner,
  },
  {
    type: 'RadioFeedText',
    label: 'Radio Feed (Text)',
    description: 'Text feed of transcribed radio messages',
    help: RadioFeedText_HELP,
    category: 'Radio',
    color: 'var(--pink)',
    defaultSize: { w: 6, h: 8 },
    minH: 3,
    fitContent: false,
    component: RadioFeedText,
  },
  {
    type: 'StandingsBoard',
    label: 'Standings Board',
    description: 'Projected driver + constructor points board',
    help: StandingsBoard_HELP,
    category: 'Standings',
    color: 'var(--green)',
    defaultSize: { w: 12, h: 8 },
    minH: 3,
    component: StandingsBoard,
  },
  {
    type: 'StandingsTable',
    label: 'Standings Table',
    description: 'Live driver and constructor championship table',
    help: StandingsTable_HELP,
    category: 'Standings',
    color: 'var(--gold)',
    defaultSize: { w: 12, h: 8 },
    minH: 3,
    component: StandingsTable,
  },
  {
    type: 'ChampionshipCalculator',
    label: 'Championship Calculator',
    description: 'What-if points outcomes and title scenarios',
    help: ChampionshipCalculator_HELP,
    category: 'Standings',
    color: 'var(--gold)',
    defaultSize: { w: 10, h: 8 },
    minH: 3,
    component: ChampionshipCalculator,
  },
  {
    type: 'PointsDeltaTracker',
    label: 'Points Delta Tracker',
    description: 'Historic points swing between contenders',
    help: PointsDeltaTracker_HELP,
    category: 'Standings',
    color: 'var(--gold)',
    defaultSize: { w: 8, h: 4 },
    minH: 3,
    component: PointsDeltaTracker,
  },
]

export const WIDGET_REGISTRY: Record<string, ComponentType<{ widgetId: string }>> = Object.fromEntries(
  WIDGET_MANIFEST.map((e) => [e.type, e.component])
)

export const WIDGET_DEFAULTS: Record<string, { w: number; h: number }> = Object.fromEntries(
  WIDGET_MANIFEST.map((e) => [e.type, e.defaultSize])
)

export function getMinHeightForWidget(type: string): number {
  const entry = WIDGET_MANIFEST.find((e) => e.type === type)
  if (!entry) return 3
  return entry.fitContent === false ? entry.minH : entry.defaultSize.h
}

export const WIDGET_PICKER_LIST = WIDGET_MANIFEST.map(({ type, label, description, color }) => ({
  type,
  label,
  description,
  color,
}))

export const WIDGET_CATEGORY_MAP: Record<string, WidgetCategory> = Object.fromEntries(
  WIDGET_MANIFEST.map((e) => [e.type, e.category])
)
