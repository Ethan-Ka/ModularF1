import { useEffect, useRef, useState } from 'react'
import { useDraggingStore } from '../../store/draggingStore'

interface WidgetPickerProps {
  onClose: () => void
  onAdd: (type: string) => void
}

interface WidgetDef {
  type: string
  label: string
  description: string
  color: string
}

const WIDGETS: WidgetDef[] = [
  {
    type: 'LapDeltaTower',
    label: 'Lap Delta Tower',
    description: 'Full ranking table with gap, interval, sector times',
    color: 'var(--red)',
  },
  {
    type: 'LapTimeCard',
    label: 'Lap Time Card',
    description: 'Single-driver lap card with live split context',
    color: 'var(--red)',
  },
  {
    type: 'GapEvolutionChart',
    label: 'Gap Evolution Chart',
    description: 'Gap history chart between two selected drivers',
    color: 'var(--red)',
  },
  {
    type: 'StintPaceComparison',
    label: 'Stint Pace Comparison',
    description: 'Compares pace in a matched tyre age window',
    color: 'var(--purple)',
  },
  {
    type: 'HeadToHeadDelta',
    label: 'Head-to-Head Delta',
    description: 'Direct comparison card for two driver targets',
    color: 'var(--red)',
  },
  {
    type: 'SectorMiniCards',
    label: 'Sector Mini-Cards',
    description: 'Compact S1/S2/S3 performance cards',
    color: 'var(--red)',
  },
  {
    type: 'SpeedGauge',
    label: 'Speed Gauge',
    description: 'Live speed telemetry with gear/rpm view',
    color: 'var(--purple)',
  },
  {
    type: 'ThrottleBrakeTrace',
    label: 'Throttle / Brake Trace',
    description: 'Pedal input timeline for focused driver',
    color: 'var(--purple)',
  },
  {
    type: 'GearTrace',
    label: 'Gear Trace',
    description: 'Rolling gear selection trace over time',
    color: 'var(--purple)',
  },
  {
    type: 'ThrottleHeatmap',
    label: 'Throttle Heatmap',
    description: 'Lap segment throttle intensity heatmap',
    color: 'var(--purple)',
  },
  {
    type: 'ERSMicroSectors',
    label: 'ERS Micro-Sectors',
    description: 'Inferred ERS deployment by micro-sector',
    color: 'var(--purple)',
  },
  {
    type: 'DRSEfficiency',
    label: 'DRS Efficiency',
    description: 'Inferred open-vs-closed DRS delta metric',
    color: 'var(--purple)',
  },
  {
    type: 'EngineModeTracker',
    label: 'Engine Mode Tracker',
    description: 'Inferred power mode behavior tracker',
    color: 'var(--purple)',
  },
  {
    type: 'RunningOrderStrip',
    label: 'Running Order Strip',
    description: 'Horizontal dot row of all 20 drivers by position',
    color: 'var(--orange)',
  },
  {
    type: 'RaceControlFeed',
    label: 'Race Control Feed',
    description: 'Timestamped flag and incident log',
    color: 'var(--gold)',
  },
  {
    type: 'StrategyTimeline',
    label: 'Strategy Timeline',
    description: 'All-driver stint timeline with pit markers',
    color: 'var(--gold)',
  },
  {
    type: 'DegRateGraph',
    label: 'Deg Rate Graph',
    description: 'Inferred tyre degradation curve by stint',
    color: 'var(--gold)',
  },
  {
    type: 'PitWindowUrgency',
    label: 'Pit Window Urgency',
    description: 'Inferred urgency signal for next stop window',
    color: 'var(--gold)',
  },
  {
    type: 'PitStopLog',
    label: 'Pit Stop Log',
    description: 'Chronological pit stop history list',
    color: 'var(--gold)',
  },
  {
    type: 'UndercutSimulator',
    label: 'Undercut Simulator',
    description: 'Scenario calculator for undercut outcomes',
    color: 'var(--gold)',
  },
  {
    type: 'TyreIntelligence',
    label: 'Tyre Intelligence',
    description: 'Cliff lap prediction with editable formula ~EST',
    color: 'var(--green)',
  },
  {
    type: 'WeatherDashboard',
    label: 'Weather Dashboard',
    description: '6 live weather metrics with trend arrows',
    color: 'var(--cyan)',
  },
  {
    type: 'TrackTempEvolution',
    label: 'Track Temp Evolution',
    description: 'Track temperature chart with inferred overlays',
    color: 'var(--blue)',
  },
  {
    type: 'WindDirection',
    label: 'Wind Direction',
    description: 'Wind direction and drift changes by heading',
    color: 'var(--blue)',
  },
  {
    type: 'WeatherRadar',
    label: 'Weather Radar',
    description: 'Windy embed centered on circuit',
    color: 'var(--blue)',
  },
  {
    type: 'FullTrackMap',
    label: 'Full Track Map',
    description: 'Live driver positions on SVG circuit outline',
    color: 'var(--purple)',
  },
  {
    type: 'SectorMap',
    label: 'Sector Map',
    description: 'Track sectors with driver position context',
    color: 'var(--green)',
  },
  {
    type: 'OvertakeReplay',
    label: 'Overtake Replay',
    description: 'Historic overtake events and replay timeline',
    color: 'var(--green)',
  },
  {
    type: 'RadioScanner',
    label: 'Radio Scanner',
    description: 'Live team radio channel scanner',
    color: 'var(--pink)',
  },
  {
    type: 'RadioFeedText',
    label: 'Radio Feed (Text)',
    description: 'Text feed of transcribed radio messages',
    color: 'var(--pink)',
  },
  {
    type: 'StandingsBoard',
    label: 'Standings Board',
    description: 'Projected driver + constructor points board',
    color: 'var(--green)',
  },
  {
    type: 'StandingsTable',
    label: 'Standings Table',
    description: 'Live driver and constructor championship table',
    color: 'var(--gold)',
  },
  {
    type: 'ChampionshipCalculator',
    label: 'Championship Calculator',
    description: 'What-if points outcomes and title scenarios',
    color: 'var(--gold)',
  },
  {
    type: 'PointsDeltaTracker',
    label: 'Points Delta Tracker',
    description: 'Historic points swing between contenders',
    color: 'var(--gold)',
  },
  {
    type: 'CarVisualization',
    label: 'Car Visualization',
    description: '2026 car profile with telemetry overlays',
    color: 'var(--purple)',
  },
]

// --- Mini preview components ---

function PreviewLapDeltaTower() {
  const rows = [
    { pos: 1, abbr: 'VER', gap: '1:23.4', color: '#3b82f6' },
    { pos: 2, abbr: 'NOR', gap: '+0.8', color: '#f97316' },
    { pos: 3, abbr: 'LEC', gap: '+1.2', color: '#ef4444' },
    { pos: 4, abbr: 'HAM', gap: '+3.4', color: '#14b8a6' },
  ]
  return (
    <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((row) => (
        <div key={row.pos} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 3, height: 14, borderRadius: 1, background: row.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', width: 10, textAlign: 'right' }}>
            {row.pos}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--white)', width: 24 }}>
            {row.abbr}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: row.pos === 1 ? 'var(--white)' : 'var(--muted)' }}>
            {row.gap}
          </span>
        </div>
      ))}
    </div>
  )
}

function PreviewRunningOrderStrip() {
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#14b8a6','#f59e0b']
  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {COLORS.map((c, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {COLORS.map((_, i) => (
          <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted2)', width: 6, textAlign: 'center' }}>
            P{i + 1}
          </span>
        ))}
      </div>
    </div>
  )
}

function PreviewRaceControlFeed() {
  const rows = [
    { ts: '14:23:01', msg: 'GREEN FLAG — RACING' },
    { ts: '14:18:44', msg: 'YELLOW FLAG — T12' },
    { ts: '14:15:02', msg: 'SC DEPLOYED' },
  ]
  return (
    <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', flexShrink: 0 }}>{row.ts}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted)', lineHeight: 1.3 }}>{row.msg}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewWeatherDashboard() {
  const metrics = [
    { label: 'AIR', value: '22°C' },
    { label: 'TRACK', value: '38°C' },
    { label: 'HUM', value: '54%' },
    { label: 'WIND', value: '12' },
    { label: 'DIR', value: '270°' },
    { label: 'RAIN', value: '0mm' },
  ]
  return (
    <div style={{ padding: '6px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
      {metrics.map((m) => (
        <div key={m.label} style={{
          background: 'var(--bg3)',
          borderRadius: 2,
          padding: '3px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.08em' }}>{m.label}</span>
          <span style={{ fontFamily: 'var(--cond)', fontSize: 12, fontWeight: 700, color: 'var(--white)', lineHeight: 1 }}>{m.value}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewTyreIntelligence() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      padding: '6px 10px',
    }}>
      <div style={{
        background: '#eab308',
        borderRadius: 2,
        padding: '2px 8px',
        fontFamily: 'var(--mono)',
        fontSize: 8,
        fontWeight: 700,
        color: '#000',
        letterSpacing: '0.08em',
      }}>
        MEDIUM
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)' }}>Age 14 laps</span>
      <div style={{ width: '100%', height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: '60%', height: '100%', background: '#f59e0b', borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--red)', letterSpacing: '0.06em' }}>
        Cliff: lap 28 ~EST
      </span>
    </div>
  )
}

function PreviewFullTrackMap() {
  const dots = [
    { cx: 80, cy: 30, color: '#ef4444' },
    { cx: 135, cy: 22, color: '#f97316' },
    { cx: 168, cy: 50, color: '#3b82f6' },
    { cx: 140, cy: 72, color: '#22c55e' },
    { cx: 55, cy: 62, color: '#8b5cf6' },
  ]
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <svg viewBox="0 0 200 90" style={{ width: '100%', height: '100%' }}>
        {/* Simplified Silverstone-ish oval path */}
        <path
          d="M 30 45 Q 30 15 70 12 L 130 10 Q 170 8 175 30 L 178 55 Q 178 78 145 80 L 60 82 Q 28 80 28 60 Z"
          fill="none"
          stroke="var(--border2)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={4} fill={d.color} />
        ))}
      </svg>
    </div>
  )
}

function PreviewWeatherRadar() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Grid background */}
      <svg viewBox="0 0 120 75" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Grid lines */}
        {[0,1,2,3,4,5].map((i) => (
          <line key={`h${i}`} x1={0} y1={i * 15} x2={120} y2={i * 15} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <line key={`v${i}`} x1={i * 17} y1={0} x2={i * 17} y2={75} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {/* Radar sweep arc */}
        <path
          d="M 60 37 L 60 10 A 27 27 0 0 1 85 50 Z"
          fill="rgba(34,197,94,0.15)"
          stroke="rgba(34,197,94,0.4)"
          strokeWidth="0.5"
        />
        {/* Center dot */}
        <circle cx={60} cy={37} r={2.5} fill="#22c55e" opacity={0.8} />
      </svg>
      {/* Label */}
      <span style={{
        position: 'absolute',
        bottom: 6,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: 'var(--mono)',
        fontSize: 6,
        color: 'var(--muted2)',
        letterSpacing: '0.1em',
      }}>
        SILVERSTONE
      </span>
    </div>
  )
}

function PreviewStandingsBoard() {
  const rows = [
    { pos: 1, code: 'NOR', pts: 25, color: '#f97316' },
    { pos: 2, code: 'VER', pts: 18, color: '#3b82f6' },
    { pos: 3, code: 'LEC', pts: 15, color: '#ef4444' },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 4,
      height: '100%',
      padding: '5px 6px',
      boxSizing: 'border-box',
    }}>
      {[0, 1].map((panel) => (
        <div
          key={panel}
          style={{
            border: '0.5px solid var(--border)',
            borderRadius: 2,
            overflow: 'hidden',
            background: 'var(--bg3)',
          }}
        >
          <div style={{
            height: 11,
            borderBottom: '0.5px solid var(--border)',
            background: 'var(--bg4)',
            fontFamily: 'var(--mono)',
            fontSize: 5,
            color: 'var(--muted2)',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {panel === 0 ? 'DRIVERS' : 'TEAMS'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row) => (
              <div key={`${panel}-${row.code}`} style={{
                height: 11,
                borderBottom: '0.5px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: '8px 2px 1fr 10px',
                alignItems: 'center',
                columnGap: 3,
                padding: '0 4px',
                boxSizing: 'border-box',
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted2)', textAlign: 'right' }}>
                  {row.pos}
                </span>
                <div style={{ width: 2, height: 7, borderRadius: 1, background: row.color }} />
                <span style={{ fontFamily: 'var(--cond)', fontSize: 8, color: 'var(--white)', lineHeight: 1 }}>
                  {panel === 0 ? row.code : `T${row.pos}`}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted)' }}>
                  {row.pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const PREVIEW_MAP: Record<string, () => React.ReactElement> = {
  LapDeltaTower: PreviewLapDeltaTower,
  RunningOrderStrip: PreviewRunningOrderStrip,
  RaceControlFeed: PreviewRaceControlFeed,
  WeatherDashboard: PreviewWeatherDashboard,
  TyreIntelligence: PreviewTyreIntelligence,
  FullTrackMap: PreviewFullTrackMap,
  WeatherRadar: PreviewWeatherRadar,
  StandingsBoard: PreviewStandingsBoard,
}

function WidgetCard({
  widget,
  onAdd,
  onClose,
  index,
}: {
  widget: WidgetDef
  onAdd: (type: string) => void
  onClose: () => void
  index: number
}) {
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const setDraggingType = useDraggingStore((s) => s.setDraggingType)

  const PreviewComponent = PREVIEW_MAP[widget.type]

  function handleClick() {
    onAdd(widget.type)
    onClose()
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', widget.type)
    setDraggingType(widget.type)
    setDragging(true)
  }

  function handleDragEnd() {
    setDraggingType(null)
    setDragging(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={true}
      className="interactive-card stagger-item"
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 130,
        height: 120,
        background: 'var(--bg4)',
        border: `0.5px solid ${hovered ? 'var(--border3)' : 'var(--border)'}`,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        opacity: dragging ? 0.6 : 1,
        transition: 'border-color 0.12s, opacity 0.1s',
        flexShrink: 0,
        ['--stagger-delay' as string]: `${Math.min(index * 22, 240)}ms`,
      }}
    >
      {/* Mini preview (top 75px) */}
      <div style={{
        height: 75,
        flexShrink: 0,
        background: 'var(--bg3)',
        borderBottom: '0.5px solid var(--border)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {PreviewComponent ? <PreviewComponent /> : (
          <div style={{
            width: '100%',
            height: '100%',
            background: `${widget.color}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ width: 24, height: 24, borderRadius: 3, background: widget.color, opacity: 0.7 }} />
          </div>
        )}
      </div>

      {/* Info (bottom 45px) */}
      <div style={{
        height: 45,
        padding: '5px 7px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}>
        <div style={{
          fontFamily: 'var(--cond)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--white)',
          letterSpacing: '0.01em',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {widget.label}
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--muted2)',
          letterSpacing: '0.04em',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {widget.description}
        </div>
      </div>
    </div>
  )
}

export function WidgetPicker({ onClose, onAdd }: WidgetPickerProps) {
  const EXIT_MS = 220
  const [query, setQuery] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleRequestClose() {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      onClose()
    }, EXIT_MS)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const filtered = query.trim()
    ? WIDGETS.filter(
        (w) =>
          w.label.toLowerCase().includes(query.toLowerCase()) ||
          w.description.toLowerCase().includes(query.toLowerCase())
      )
    : WIDGETS

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleRequestClose}
        className={isClosing ? 'glass-overlay glass-overlay-exit' : 'glass-overlay'}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.35)',
          zIndex: 200,
        }}
      />

      {/* Slide-in panel */}
      <div
        className={isClosing ? 'animated-slide-right-exit' : 'animated-slide-right'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 296,
          background: 'var(--bg3)',
          borderLeft: '0.5px solid var(--border2)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          animation: 'pickerSlideIn 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px 10px',
            borderBottom: '0.5px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--white)',
                display: 'block',
              }}
            >
              WIDGETS
            </span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--muted2)',
                letterSpacing: '0.06em',
                display: 'block',
                marginTop: 2,
              }}
            >
              Drag onto canvas or click to add
            </span>
          </div>
          <button
            onClick={handleRequestClose}
            className="interactive-button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted2)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 2px',
              transition: 'color 0.1s',
            }}
            aria-label="Close widget picker"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search widgets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 10px',
              background: 'var(--bg4)',
              border: '0.5px solid var(--border)',
              borderRadius: 3,
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--white)',
              outline: 'none',
            }}
          />
        </div>

        {/* Widget grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 16px' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '24px 0',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted2)',
                letterSpacing: '0.08em',
                textAlign: 'center',
              }}
            >
              No widgets match "{query}"
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              justifyItems: 'center',
            }}>
              {filtered.map((widget, index) => (
                <WidgetCard
                  key={widget.type}
                  widget={widget}
                  onAdd={onAdd}
                  onClose={handleRequestClose}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes pickerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
