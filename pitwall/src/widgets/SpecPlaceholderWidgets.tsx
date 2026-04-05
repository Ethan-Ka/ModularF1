interface SpecWidgetProps {
  widgetId: string
}

interface SpecWidgetMeta {
  title: string
  subtitle: string
  accent: string
}

function SpecPlaceholderWidget({ widgetId, title, subtitle, accent }: SpecWidgetProps & SpecWidgetMeta) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 4,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        border: '0.5px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 12px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 4,
          borderRadius: 2,
          background: accent,
          marginBottom: 10,
          opacity: 0.85,
        }}
      />
      <div
        style={{
          fontFamily: 'var(--cond)',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--white)',
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          marginBottom: 10,
        }}
      >
        Prototype widget
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--muted)',
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          marginTop: 'auto',
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.06em',
          color: 'var(--muted2)',
        }}
      >
        id: {widgetId}
      </div>
    </div>
  )
}

function createSpecWidget(meta: SpecWidgetMeta) {
  return function SpecWidget(props: SpecWidgetProps) {
    return <SpecPlaceholderWidget {...props} {...meta} />
  }
}

export const LapTimeCard = createSpecWidget({
  title: 'Lap Time Card',
  subtitle: 'Single-driver timing card with lap and split context.',
  accent: 'var(--red)',
})

export const GapEvolutionChart = createSpecWidget({
  title: 'Gap Evolution',
  subtitle: 'Session-long gap trend for two selectable drivers.',
  accent: 'var(--red)',
})

export const StintPaceComparison = createSpecWidget({
  title: 'Stint Pace Comparison',
  subtitle: 'Compares average stint pace within a shared tyre-age window.',
  accent: 'var(--purple)',
})

export const HeadToHeadDelta = createSpecWidget({
  title: 'Head-to-Head Delta',
  subtitle: 'Direct two-driver metric comparison card.',
  accent: 'var(--red)',
})

export const SectorMiniCards = createSpecWidget({
  title: 'Sector Mini-Cards',
  subtitle: 'Compact S1/S2/S3 status and deltas for focused driver.',
  accent: 'var(--red)',
})

export const SpeedGauge = createSpecWidget({
  title: 'Speed Gauge',
  subtitle: 'Live telemetry speed, gear, and rpm display.',
  accent: 'var(--purple)',
})

export const ThrottleBrakeTrace = createSpecWidget({
  title: 'Throttle / Brake Trace',
  subtitle: 'Live pedal trace timeline for throttle and brake inputs.',
  accent: 'var(--purple)',
})

export const GearTrace = createSpecWidget({
  title: 'Gear Trace',
  subtitle: 'Rolling trace of gear selection over lap segments.',
  accent: 'var(--purple)',
})

export const ThrottleHeatmap = createSpecWidget({
  title: 'Throttle Heatmap',
  subtitle: 'Lap segment intensity map for throttle application.',
  accent: 'var(--purple)',
})

export const ERSMicroSectors = createSpecWidget({
  title: 'ERS Micro-Sectors',
  subtitle: 'Inferred ERS deployment patterns across micro-sectors.',
  accent: 'var(--purple)',
})

export const DRSEfficiency = createSpecWidget({
  title: 'DRS Efficiency',
  subtitle: 'Inferred delta between open/closed DRS sections.',
  accent: 'var(--purple)',
})

export const EngineModeTracker = createSpecWidget({
  title: 'Engine Mode Tracker',
  subtitle: 'Inferred power-mode behavior from telemetry signatures.',
  accent: 'var(--purple)',
})

export const StrategyTimeline = createSpecWidget({
  title: 'Strategy Timeline',
  subtitle: 'Multi-driver stint bars and pit markers across race laps.',
  accent: 'var(--gold)',
})

export const DegRateGraph = createSpecWidget({
  title: 'Deg Rate Graph',
  subtitle: 'Inferred tyre degradation curve over stint progression.',
  accent: 'var(--gold)',
})

export const PitWindowUrgency = createSpecWidget({
  title: 'Pit Window Urgency',
  subtitle: 'Inferred stop urgency signal for current tyre state.',
  accent: 'var(--gold)',
})

export const PitStopLog = createSpecWidget({
  title: 'Pit Stop Log',
  subtitle: 'Chronological stop list with lane and duration details.',
  accent: 'var(--gold)',
})

export const UndercutSimulator = createSpecWidget({
  title: 'Undercut Simulator',
  subtitle: 'Inferred outcome estimate for undercut/overcut scenarios.',
  accent: 'var(--gold)',
})

export const SectorMap = createSpecWidget({
  title: 'Sector Map',
  subtitle: 'Track sectors with per-sector state and focus-driver context.',
  accent: 'var(--green)',
})

export const OvertakeReplay = createSpecWidget({
  title: 'Overtake Replay',
  subtitle: 'Historic pass events with track-location playback cues.',
  accent: 'var(--green)',
})

export const TrackTempEvolution = createSpecWidget({
  title: 'Track Temp Evolution',
  subtitle: 'Track temperature timeline with inferred overlays.',
  accent: 'var(--blue)',
})

export const WindDirection = createSpecWidget({
  title: 'Wind Direction',
  subtitle: 'Compass-oriented wind indicator and directional trend.',
  accent: 'var(--blue)',
})

export const RadioScanner = createSpecWidget({
  title: 'Radio Scanner',
  subtitle: 'Live team-radio channel monitor and activity queue.',
  accent: 'var(--pink)',
})

export const RadioFeedText = createSpecWidget({
  title: 'Radio Feed (Text)',
  subtitle: 'Text timeline of transcribed radio messages.',
  accent: 'var(--pink)',
})

export const StandingsTable = createSpecWidget({
  title: 'Standings Table',
  subtitle: 'Live driver/constructor table with provisional points.',
  accent: 'var(--gold)',
})

export const ChampionshipCalculator = createSpecWidget({
  title: 'Championship Calculator',
  subtitle: 'What-if points outcomes and title scenario math.',
  accent: 'var(--gold)',
})

export const PointsDeltaTracker = createSpecWidget({
  title: 'Points Delta Tracker',
  subtitle: 'Historic points swing timeline between contenders.',
  accent: 'var(--gold)',
})

export const CarVisualization = createSpecWidget({
  title: 'Car Visualization',
  subtitle: '2026 car profile with telemetry and inferred overlays.',
  accent: 'var(--purple)',
})
