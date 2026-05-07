import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDraggingStore } from '../../store/draggingStore'
import { WIDGET_DEFAULTS } from '../../widgets/registry'
import { WIDGET_PICKER_LIST, WIDGET_CATEGORY_MAP as MANIFEST_CATEGORY_MAP } from '../../widgets/manifest'
import type { WidgetCategory as ManifestWidgetCategory } from '../../widgets/manifest'
import { SmoothScrollContainer } from '../SmoothScrollContainer'

const GRID_COLS = 24
const GRID_ROW_HEIGHT = 40
const GRID_MARGIN_X = 4
const GRID_MARGIN_Y = 4

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

type WidgetCategory = ManifestWidgetCategory

const CATEGORY_ORDER: WidgetCategory[] = [
  'Timing',
  'Telemetry',
  'Race Control',
  'Strategy',
  'Weather',
  'Track',
  'Radio',
  'Standings',
]

const CATEGORY_COLORS: Record<WidgetCategory, string> = {
  Timing: 'var(--red)',
  Telemetry: 'var(--purple)',
  'Race Control': 'var(--orange)',
  Strategy: 'var(--gold)',
  Weather: 'var(--cyan)',
  Track: 'var(--blue)',
  Radio: 'var(--pink)',
  Standings: 'var(--green)',
}

const WIDGET_CATEGORY_MAP: Record<string, WidgetCategory> = MANIFEST_CATEGORY_MAP

function getWidgetCategory(type: string): WidgetCategory {
  return WIDGET_CATEGORY_MAP[type] ?? 'Telemetry'
}

function getWidgetInitials(label: string): string {
  const words = label
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'WG'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

function resolveCssColor(color: string, fallback: string): string {
  const match = /^var\((--[^)]+)\)$/.exec(color.trim())
  if (!match) return color
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim()
  return resolved || fallback
}

function getDragPreviewDimensions(type: string): { width: number; height: number; w: number; h: number } {
  const defaults = WIDGET_DEFAULTS[type] ?? { w: 6, h: 6 }
  const canvas = document.querySelector<HTMLElement>('[data-canvas-dropzone="true"]')
  const widthPx = canvas?.clientWidth ?? 1200
  const colWidth = (widthPx - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS

  if (!Number.isFinite(colWidth) || colWidth <= 0) {
    return {
      width: Math.max(120, defaults.w * 20),
      height: Math.max(72, defaults.h * 12),
      w: defaults.w,
      h: defaults.h,
    }
  }

  const exactWidth = Math.max(96, Math.round(defaults.w * colWidth + (defaults.w - 1) * GRID_MARGIN_X))
  const exactHeight = Math.max(48, Math.round(defaults.h * GRID_ROW_HEIGHT + (defaults.h - 1) * GRID_MARGIN_Y))

  return {
    width: exactWidth,
    height: exactHeight,
    w: defaults.w,
    h: defaults.h,
  }
}

function emitPickerDragHover(active: boolean) {
  window.dispatchEvent(new CustomEvent('pitwall:picker-drag-hover', { detail: { active } }))
}

function createCanvasDragImage(label: string, color: string, width: number, height: number): HTMLCanvasElement {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.scale(dpr, dpr)

  // Background fill
  ctx.fillStyle = 'rgba(12, 14, 20, 0.92)'
  ctx.fillRect(0, 0, width, height)

  // Subtle inner highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1
  ctx.strokeRect(1, 1, Math.max(0, width - 2), Math.max(0, height - 2))

  // Strong outer border so large previews always retain an obvious edge.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, Math.max(0, width - 2), Math.max(0, height - 2))

  // Dashed accent border.
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.setLineDash([10, 7])
  ctx.strokeRect(4, 4, Math.max(0, width - 8), Math.max(0, height - 8))
  ctx.setLineDash([])

  // Label
  ctx.fillStyle = '#f5f7fb'
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, height / 2)

  return canvas
}

const WIDGETS: WidgetDef[] = WIDGET_PICKER_LIST

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
  const drivers = [
    { abbr: 'NOR', color: '#f97316' },
    { abbr: 'VER', color: '#3b82f6' },
    { abbr: 'LEC', color: '#ef4444' },
    { abbr: 'HAM', color: '#14b8a6' },
    { abbr: 'SAI', color: '#ef4444' },
    { abbr: 'RUS', color: '#14b8a6' },
    { abbr: 'PIA', color: '#f97316' },
    { abbr: 'ALO', color: '#22c55e' },
  ]
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '4px 6px' }}>
      <div style={{ width: '100%', display: 'flex', gap: 1 }}>
        {drivers.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted2)', lineHeight: 1 }}>P{i + 1}</span>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: d.color }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 4.5, color: 'var(--white)', letterSpacing: '-0.02em', lineHeight: 1 }}>{d.abbr}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewRaceControlFeed() {
  const rows = [
    { ts: '14:23', msg: 'GREEN FLAG — RACING', dot: '#22c55e' },
    { ts: '14:18', msg: 'YELLOW — SECTOR 3', dot: '#eab308' },
    { ts: '14:15', msg: 'SAFETY CAR DEPLOYED', dot: '#f97316' },
    { ts: '14:08', msg: 'DRS ENABLED — ALL', dot: '#22c55e' },
  ]
  return (
    <div style={{ padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 4, height: '100%', boxSizing: 'border-box' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: row.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', flexShrink: 0, width: 26 }}>{row.ts}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted)', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{row.msg}</span>
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
    <div style={{ height: '100%', padding: '7px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ background: '#eab308', borderRadius: 2, padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: 7, fontWeight: 700, color: '#000', letterSpacing: '0.08em' }}>
          MEDIUM
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>14 laps</span>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>WEAR</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: '#f59e0b' }}>58%</span>
        </div>
        <div style={{ width: '100%', height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '58%', height: '100%', background: 'linear-gradient(90deg, #22c55e, #eab308, #f97316)', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>CLIFF ~EST</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: '#ef4444', letterSpacing: '0.04em' }}>LAP 28</span>
      </div>
    </div>
  )
}

function PreviewFullTrackMap() {
  const dots = [
    { cx: 78, cy: 18, color: '#f97316' },
    { cx: 102, cy: 14, color: '#3b82f6' },
    { cx: 132, cy: 22, color: '#ef4444' },
    { cx: 148, cy: 44, color: '#14b8a6' },
    { cx: 120, cy: 64, color: '#8b5cf6' },
    { cx: 62, cy: 60, color: '#22c55e' },
  ]
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
      <svg viewBox="0 0 190 82" style={{ width: '100%', height: '100%' }}>
        {/* Circuit outline — Silverstone inspired */}
        <path
          d="M 28 42 Q 26 22 42 14 L 68 8 Q 88 4 104 10 L 128 8 Q 148 6 158 18 L 162 30 Q 164 42 158 52 L 152 62 Q 144 72 128 74 L 88 76 Q 60 78 44 70 L 30 58 Q 26 52 28 42 Z"
          fill="none"
          stroke="var(--border2)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Driver dots with white border */}
        {dots.map((d, i) => (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r={5.5} fill="var(--bg3)" />
            <circle cx={d.cx} cy={d.cy} r={4} fill={d.color} />
          </g>
        ))}
        {/* P1 label */}
        <text x={78} y={10} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">P1</text>
      </svg>
    </div>
  )
}

function PreviewWeatherRadar() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 120 75" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Range rings */}
        {[14, 24, 34].map((r) => (
          <circle key={r} cx={60} cy={38} r={r} fill="none" stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {/* Crosshairs */}
        <line x1={60} y1={4} x2={60} y2={72} stroke="var(--border)" strokeWidth="0.5" />
        <line x1={26} y1={38} x2={94} y2={38} stroke="var(--border)" strokeWidth="0.5" />
        {/* Precipitation blobs */}
        <ellipse cx={74} cy={28} rx={8} ry={5} fill="rgba(34,197,94,0.35)" />
        <ellipse cx={82} cy={30} rx={5} ry={3} fill="rgba(34,197,94,0.55)" />
        <ellipse cx={54} cy={50} rx={4} ry={3} fill="rgba(34,197,94,0.2)" />
        {/* Radar sweep */}
        <path d="M 60 38 L 60 4 A 34 34 0 0 1 94 38 Z" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.35)" strokeWidth="0.5" />
        {/* Center */}
        <circle cx={60} cy={38} r={3} fill="#22c55e" opacity={0.9} />
        {/* Cardinal labels */}
        <text x={60} y={8} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">N</text>
        <text x={60} y={71} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">S</text>
        <text x={21} y={40} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">W</text>
        <text x={99} y={40} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">E</text>
      </svg>
      <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 5.5, color: 'var(--muted2)', letterSpacing: '0.1em' }}>
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

function PreviewLastLapCard() {
  return (
    <div style={{ height: '100%', padding: '7px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.1em' }}>LAST LAP (L47)</span>
      <span style={{ fontFamily: 'var(--cond)', fontSize: 18, fontWeight: 700, color: 'var(--white)', lineHeight: 1 }}>1:28.642</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {['S1 28.4', 'S2 31.1', 'S3 29.1'].map((v) => (
          <span key={v} style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted)', textAlign: 'center' }}>{v}</span>
        ))}
      </div>
    </div>
  )
}

function PreviewLiveLapTimeCard() {
  return (
    <div style={{ height: '100%', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.08em' }}>LIVE · L48</span>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#e8002d' }} />
      </div>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', opacity: 0.5, lineHeight: 1, marginBottom: 2 }}>PREV 1:28.642</div>
        <div style={{ fontFamily: 'var(--cond)', fontSize: 24, fontWeight: 700, color: '#e8002d', lineHeight: 1, textShadow: '0 0 10px #e8002d55', letterSpacing: '-0.01em' }}>1:14.3__</div>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[{ label: 'S1', color: '#a3e635' }, { label: 'S2', color: '#a3e635' }, { label: 'S3', color: 'var(--muted2)' }].map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: s.color }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewGapEvolutionChart() {
  return (
    <div style={{ height: '100%', padding: '6px 7px 4px', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 120 68" style={{ width: '100%', height: '100%' }}>
        {/* Grid */}
        {[14, 28, 42, 56].map((y) => (
          <line key={y} x1={14} y1={y} x2={118} y2={y} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {/* Zero baseline */}
        <line x1={14} y1={34} x2={118} y2={34} stroke="var(--border2)" strokeWidth="1" strokeDasharray="3 2" />
        {/* Driver gap lines */}
        <polyline fill="none" stroke="#f97316" strokeWidth="1.8" points="14,52 30,46 46,42 62,44 78,38 94,32 110,26 118,22" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="1.8" points="14,28 30,30 46,26 62,28 78,24 94,20 110,18 118,16" />
        <polyline fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" points="14,58 30,56 46,54 62,58 78,60 94,58 110,56 118,54" />
        {/* Y-axis labels */}
        <text x={12} y={35} textAnchor="end" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">0</text>
        <text x={12} y={15} textAnchor="end" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">+1</text>
        <text x={12} y={55} textAnchor="end" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">−1</text>
        {/* Legend */}
        <circle cx={16} cy={62} r={2} fill="#f97316" />
        <text x={20} y={64} fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">NOR</text>
        <circle cx={40} cy={62} r={2} fill="#3b82f6" />
        <text x={44} y={64} fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">VER</text>
        <circle cx={64} cy={62} r={2} fill="#ef4444" />
        <text x={68} y={64} fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">LEC</text>
      </svg>
    </div>
  )
}

function PreviewStintPaceComparison() {
  const bars = [82, 74, 66, 58]
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
      {bars.map((w, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 26px', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>L{i + 8}</span>
          <div style={{ height: 4, borderRadius: 3, background: 'var(--bg2)', overflow: 'hidden' }}>
            <div style={{ width: `${w}%`, height: '100%', background: i % 2 ? '#f97316' : '#3b82f6' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted)' }}>{(88 + i / 10).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewHeadToHeadDelta() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
      {[
        { code: 'NOR', color: '#f97316', delta: '-0.231' },
        { code: 'VER', color: '#3b82f6', delta: '+0.231' },
      ].map((d) => (
        <div key={d.code} style={{ background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 3, padding: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 3, height: 12, borderRadius: 1, background: d.color }} />
            <span style={{ fontFamily: 'var(--cond)', fontSize: 10, color: 'var(--white)' }}>{d.code}</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted)' }}>{d.delta}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewSectorMiniCards() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
      {[
        { key: 'S1', value: '28.4', color: '#a3e635' },
        { key: 'S2', value: '31.1', color: '#facc15' },
        { key: 'S3', value: '29.3', color: '#f87171' },
      ].map((s) => (
        <div key={s.key} style={{ background: 'var(--bg3)', borderRadius: 3, border: '0.5px solid var(--border)', padding: '4px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>{s.key}</span>
          <div style={{ width: '100%', height: 2, background: s.color, borderRadius: 2, margin: '2px 0' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--white)' }}>{s.value}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewSpeedGauge() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 110 68" style={{ width: '100%', flex: 1 }}>
        {/* Gauge track */}
        <path d="M 12 58 A 43 43 0 0 1 98 58" fill="none" stroke="var(--border2)" strokeWidth="5" strokeLinecap="round" />
        {/* Colored arc fill — ~75% of range (318 km/h of max ~360) */}
        <path d="M 12 58 A 43 43 0 0 1 88 28" fill="none" stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round" opacity={0.8} />
        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const angle = -180 + t * 180
          const rad = (angle * Math.PI) / 180
          const cx = 55 + 43 * Math.cos(rad)
          const cy = 58 + 43 * Math.sin(rad)
          const cx2 = 55 + 36 * Math.cos(rad)
          const cy2 = 58 + 36 * Math.sin(rad)
          return <line key={t} x1={cx} y1={cy} x2={cx2} y2={cy2} stroke="var(--border2)" strokeWidth="1.5" />
        })}
        {/* Needle */}
        <line x1={55} y1={58} x2={88} y2={28} stroke="var(--white)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={55} cy={58} r={3} fill="var(--white)" />
        {/* Speed value */}
        <text x={55} y={50} textAnchor="middle" fill="var(--white)" fontSize={13} fontFamily="var(--cond)" fontWeight="700">318</text>
        <text x={55} y={58} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">km/h</text>
        {/* Gear badge */}
        <rect x={84} y={52} width={16} height={12} rx={2} fill="#8b5cf644" stroke="#8b5cf699" strokeWidth="0.5" />
        <text x={92} y={61} textAnchor="middle" fill="var(--white)" fontSize={8} fontFamily="var(--mono)" fontWeight="700">7</text>
      </svg>
    </div>
  )
}

function PreviewThrottleBrakeTrace() {
  return (
    <div style={{ height: '100%', padding: '5px 7px', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 114 64" style={{ width: '100%', height: '100%' }}>
        {/* Grid */}
        {[16, 32, 48].map((y) => (
          <line key={y} x1={0} y1={y} x2={114} y2={y} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {/* Throttle — filled area (green) */}
        <polygon fill="rgba(34,197,94,0.18)" points="2,46 2,8 18,12 30,6 44,10 58,4 74,14 90,8 110,10 110,46" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="1.8" points="2,8 18,12 30,6 44,10 58,4 74,14 90,8 110,10" />
        {/* Brake — filled area (red), spikes downward from baseline */}
        <polygon fill="rgba(239,68,68,0.2)" points="2,46 2,58 18,58 30,52 44,58 58,50 74,58 90,54 110,56 110,46" />
        <polyline fill="none" stroke="#ef4444" strokeWidth="1.8" points="2,58 18,58 30,52 44,58 58,50 74,58 90,54 110,56" />
        {/* Labels */}
        <text x={2} y={7} fill="#22c55e" fontSize={5} fontFamily="var(--mono)">THR</text>
        <text x={2} y={64} fill="#ef4444" fontSize={5} fontFamily="var(--mono)">BRK</text>
      </svg>
    </div>
  )
}

function PreviewGearTrace() {
  const steps = [
    { x1: 2, x2: 18, y: 64, g: '1' },
    { x1: 18, x2: 34, y: 56, g: '2' },
    { x1: 34, x2: 52, y: 48, g: '3' },
    { x1: 52, x2: 68, y: 40, g: '4' },
    { x1: 68, x2: 84, y: 28, g: '6' },
    { x1: 84, x2: 96, y: 48, g: '4' },
    { x1: 96, x2: 114, y: 16, g: '8' },
  ]
  return (
    <div style={{ height: '100%', padding: '5px 7px', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 116 70" style={{ width: '100%', height: '100%' }}>
        {/* Y-axis gear labels */}
        {[1,2,3,4,5,6,7,8].map((g) => {
          const y = 64 - (g - 1) * 8
          return <text key={g} x={10} y={y + 2} textAnchor="middle" fill="var(--muted2)" fontSize={4.5} fontFamily="var(--mono)">{g}</text>
        })}
        <line x1={14} y1={4} x2={14} y2={68} stroke="var(--border)" strokeWidth="0.5" />
        {/* Staircase path */}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={steps.flatMap((s) => [`${s.x1 + 2},${s.y}`, `${s.x2 + 2},${s.y}`]).join(' ')}
        />
        {/* Vertical connectors */}
        {steps.slice(0, -1).map((s, i) => (
          <line key={i} x1={steps[i].x2 + 2} y1={s.y} x2={steps[i].x2 + 2} y2={steps[i + 1].y} stroke="#3b82f6" strokeWidth="2" />
        ))}
        {/* Gear labels above each segment */}
        {steps.map((s) => (
          <text key={s.g + s.x1} x={(s.x1 + s.x2) / 2 + 2} y={s.y - 3} textAnchor="middle" fill="#3b82f6" fontSize={5} fontFamily="var(--mono)">{s.g}</text>
        ))}
      </svg>
    </div>
  )
}

function PreviewThrottleHeatmap() {
  const sectors = [
    { label: 'S1', cells: [90,95,85,100,70,40,20,30,60,80] },
    { label: 'S2', cells: [100,100,90,50,10,5,15,80,95,100] },
    { label: 'S3', cells: [85,75,100,100,90,60,30,20,70,90] },
  ]
  return (
    <div style={{ height: '100%', padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box' }}>
      {sectors.map((s) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', width: 10, flexShrink: 0 }}>{s.label}</span>
          <div style={{ flex: 1, display: 'flex', gap: 1.5 }}>
            {s.cells.map((v, i) => {
              const color = v > 70 ? '#22c55e' : v > 35 ? '#eab308' : '#ef4444'
              return <div key={i} style={{ flex: 1, height: 12, borderRadius: 1, background: color, opacity: 0.6 + (v / 100) * 0.4 }} />
            })}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        {[['FULL', '#22c55e'], ['MID', '#eab308'], ['LOW', '#ef4444']].map(([lbl, c]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 5, height: 5, background: c, borderRadius: 1 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted2)' }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewERSMicroSectors() {
  const phases = [
    { label: 'HARVEST', bars: [40, 60, 50, 45, 55], color: '#facc15' },
    { label: 'DEPLOY', bars: [80, 100, 95, 70, 85], color: '#22c55e' },
    { label: 'NEUTRAL', bars: [10, 15, 5, 20, 8], color: '#3b82f6' },
  ]
  return (
    <div style={{ height: '100%', padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>ERS MICRO-SECTORS</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: '#22c55e' }}>+4.2 MJ</span>
      </div>
      {phases.map((p) => (
        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: p.color, width: 36, flexShrink: 0 }}>{p.label}</span>
          <div style={{ flex: 1, display: 'flex', gap: 2 }}>
            {p.bars.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ height: Math.round(v / 100 * 10), background: p.color, borderRadius: 1, opacity: 0.8 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PreviewDRSEfficiency() {
  return (
    <div style={{ height: '100%', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.08em' }}>DRS EFFICIENCY</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', height: 22, background: 'var(--bg2)', borderRadius: 2, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '68%', background: '#3b82f644', borderTop: '1px solid #3b82f6' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: 'var(--muted2)' }}>CLOSED</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: '#3b82f6' }}>304</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', height: 22, background: 'var(--bg2)', borderRadius: 2, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '88%', background: '#22c55e44', borderTop: '1px solid #22c55e' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: 'var(--muted2)' }}>OPEN</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: '#22c55e' }}>318</span>
        </div>
      </div>
      <div style={{ background: '#22c55e18', border: '0.5px solid #22c55e66', borderRadius: 2, padding: '2px 5px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>DELTA</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: '#22c55e' }}>+14.2 km/h</span>
      </div>
    </div>
  )
}

function PreviewEngineModeTracker() {
  const timeline = [
    { laps: '1–10', mode: 'P2', color: '#3b82f6', w: 30 },
    { laps: '11–22', mode: 'P4', color: '#ef4444', w: 36 },
    { laps: '23–35', mode: 'P3', color: '#f97316', w: 38 },
    { laps: '36–47', mode: 'P2', color: '#3b82f6', w: 34 },
  ]
  return (
    <div style={{ height: '100%', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>ENGINE MODE</span>
        <div style={{ background: '#ef4444', borderRadius: 2, padding: '1px 5px', fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--white)' }}>P4 ACTIVE</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {timeline.map((t) => (
          <div key={t.laps} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted2)', width: 22, flexShrink: 0 }}>L{t.laps}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${t.w}%`, height: '100%', background: t.color, opacity: 0.75 }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: t.color, width: 12, flexShrink: 0 }}>{t.mode}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewStrategyTimeline() {
  const drivers = [
    { abbr: 'NOR', color: '#f97316', stints: [{ c: '#eab308', w: 28 }, { c: '#dc2626', w: 38 }, { c: '#22c55e', w: 34 }] },
    { abbr: 'VER', color: '#3b82f6', stints: [{ c: '#dc2626', w: 22 }, { c: '#eab308', w: 40 }, { c: '#eab308', w: 38 }] },
    { abbr: 'LEC', color: '#ef4444', stints: [{ c: '#eab308', w: 34 }, { c: '#eab308', w: 32 }, { c: '#dc2626', w: 34 }] },
  ]
  return (
    <div style={{ height: '100%', padding: '5px 7px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>STRATEGY TIMELINE</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {drivers.map((d) => (
          <div key={d.abbr} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 3, height: 10, borderRadius: 1, background: d.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--white)', width: 18, flexShrink: 0 }}>{d.abbr}</span>
            <div style={{ flex: 1, display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
              {d.stints.map((s, i) => (
                <div key={i} style={{ width: `${s.w}%`, height: '100%', background: s.c, opacity: 0.85 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['MED', '#eab308'], ['SOFT', '#dc2626'], ['HARD', '#ebebeb']].map(([lbl, c]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 5, height: 5, background: c as string, borderRadius: 1 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'var(--muted2)' }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewDegRateGraph() {
  return (
    <div style={{ height: '100%', padding: '5px 7px', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 114 66" style={{ width: '100%', height: '100%' }}>
        {/* Grid */}
        {[16, 32, 48].map((y) => (
          <line key={y} x1={14} y1={y} x2={112} y2={y} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        <line x1={14} y1={8} x2={14} y2={60} stroke="var(--border)" strokeWidth="0.5" />
        {/* Hard — slow degradation */}
        <polyline fill="none" stroke="#d4d4d8" strokeWidth="1.8" points="14,14 32,16 50,18 68,22 86,28 104,36 112,42" />
        {/* Medium */}
        <polyline fill="none" stroke="#eab308" strokeWidth="1.8" points="14,14 32,18 50,24 68,34 86,46 104,56 112,62" />
        {/* Soft — fast degradation */}
        <polyline fill="none" stroke="#dc2626" strokeWidth="1.8" points="14,14 28,22 42,34 58,46 72,56 86,62" />
        {/* Axis labels */}
        <text x={7} y={16} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">Δt</text>
        {/* Legend */}
        <line x1={18} y1={62} x2={28} y2={62} stroke="#d4d4d8" strokeWidth="1.5" />
        <text x={30} y={64} fill="var(--muted2)" fontSize={4.5} fontFamily="var(--mono)">H</text>
        <line x1={40} y1={62} x2={50} y2={62} stroke="#eab308" strokeWidth="1.5" />
        <text x={52} y={64} fill="var(--muted2)" fontSize={4.5} fontFamily="var(--mono)">M</text>
        <line x1={62} y1={62} x2={72} y2={62} stroke="#dc2626" strokeWidth="1.5" />
        <text x={74} y={64} fill="var(--muted2)" fontSize={4.5} fontFamily="var(--mono)">S</text>
      </svg>
    </div>
  )
}

function PreviewPitWindowUrgency() {
  return (
    <div style={{ height: '100%', padding: '5px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>PIT WINDOW</span>
      <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
        <svg viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {/* Background track */}
          <circle cx={26} cy={26} r={22} fill="none" stroke="var(--border2)" strokeWidth="5" />
          {/* Urgency arc — ~80% full in red */}
          <circle
            cx={26} cy={26} r={22}
            fill="none"
            stroke="#ef4444"
            strokeWidth="5"
            strokeDasharray={`${0.8 * 138.2} ${138.2}`}
            strokeDashoffset="34.6"
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
          />
          <text x={26} y={24} textAnchor="middle" fill="var(--white)" fontSize={11} fontFamily="var(--cond)" fontWeight="700">28</text>
          <text x={26} y={32} textAnchor="middle" fill="var(--muted2)" fontSize={5} fontFamily="var(--mono)">LAP</text>
        </svg>
      </div>
      <div style={{ background: '#ef444422', border: '0.5px solid #ef4444aa', borderRadius: 2, padding: '2px 10px', fontFamily: 'var(--mono)', fontSize: 7, color: '#ef4444', letterSpacing: '0.06em' }}>
        PIT NOW
      </div>
    </div>
  )
}

function PreviewPitStopLog() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {['NOR 22.4s', 'LEC 21.8s', 'HAM 23.1s'].map((row, i) => (
        <div key={row} style={{ display: 'grid', gridTemplateColumns: '8px 1fr', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>L{i + 15}</span>
          <div style={{ height: 9, borderRadius: 2, background: 'var(--bg3)', border: '0.5px solid var(--border)', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted)' }}>{row}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function PreviewUndercutSimulator() {
  return (
    <div style={{ height: '100%', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)', letterSpacing: '0.08em' }}>UNDERCUT SIM</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, alignItems: 'center' }}>
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 3, padding: '5px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: 'var(--muted2)' }}>NOW</span>
          <span style={{ fontFamily: 'var(--cond)', fontSize: 18, fontWeight: 700, color: 'var(--white)', lineHeight: 1 }}>P4</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: 'var(--muted2)' }}>GAP +3.2s</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: 10, color: '#22c55e' }}>→</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5, color: '#22c55e' }}>+1.8s</span>
        </div>
        <div style={{ background: '#22c55e14', border: '0.5px solid #22c55e88', borderRadius: 3, padding: '5px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: '#86efac' }}>UNDERCUT</span>
          <span style={{ fontFamily: 'var(--cond)', fontSize: 18, fontWeight: 700, color: '#22c55e', lineHeight: 1 }}>P3</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 5.5, color: '#86efac' }}>AHEAD</span>
        </div>
      </div>
    </div>
  )
}

function PreviewTrackTempEvolution() {
  return (
    <div style={{ height: '100%', padding: '5px 7px', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 114 66" style={{ width: '100%', height: '100%' }}>
        {/* Grid */}
        {[16, 32, 48].map((y) => (
          <line key={y} x1={14} y1={y} x2={112} y2={y} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        <line x1={14} y1={8} x2={14} y2={60} stroke="var(--border)" strokeWidth="0.5" />
        {/* Track temp — filled area (orange) */}
        <polygon
          fill="rgba(249,115,22,0.15)"
          points="14,60 14,46 30,42 46,38 62,34 78,28 94,24 112,20 112,60"
        />
        <polyline fill="none" stroke="#f97316" strokeWidth="2" points="14,46 30,42 46,38 62,34 78,28 94,24 112,20" />
        {/* Air temp — line (blue) */}
        <polyline fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" points="14,52 30,50 46,48 62,46 78,44 94,42 112,40" />
        {/* Labels */}
        <text x={16} y={44} fill="#f97316" fontSize={5} fontFamily="var(--mono)">38°C</text>
        <text x={16} y={56} fill="#38bdf8" fontSize={5} fontFamily="var(--mono)">22°C</text>
        {/* Legend */}
        <line x1={60} y1={62} x2={70} y2={62} stroke="#f97316" strokeWidth="1.5" />
        <text x={72} y={64} fill="var(--muted2)" fontSize={4.5} fontFamily="var(--mono)">TRACK</text>
        <line x1={88} y1={62} x2={98} y2={62} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 1.5" />
        <text x={100} y={64} fill="var(--muted2)" fontSize={4.5} fontFamily="var(--mono)">AIR</text>
      </svg>
    </div>
  )
}

function PreviewWindDirection() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <svg viewBox="0 0 72 72" style={{ width: 56, height: 56 }}>
        {/* Compass rings */}
        <circle cx={36} cy={36} r={30} fill="none" stroke="var(--border)" strokeWidth="0.5" />
        <circle cx={36} cy={36} r={22} fill="none" stroke="var(--border)" strokeWidth="0.5" />
        {/* Cardinal ticks */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg - 90) * Math.PI / 180
          return <line key={deg} x1={36 + 22 * Math.cos(rad)} y1={36 + 22 * Math.sin(rad)} x2={36 + 30 * Math.cos(rad)} y2={36 + 30 * Math.sin(rad)} stroke="var(--border2)" strokeWidth="1" />
        })}
        {/* Cardinal labels */}
        <text x={36} y={8} textAnchor="middle" fill="var(--muted2)" fontSize={6} fontFamily="var(--mono)">N</text>
        <text x={36} y={68} textAnchor="middle" fill="var(--muted2)" fontSize={6} fontFamily="var(--mono)">S</text>
        <text x={6} y={38} textAnchor="middle" fill="var(--muted2)" fontSize={6} fontFamily="var(--mono)">W</text>
        <text x={66} y={38} textAnchor="middle" fill="var(--muted2)" fontSize={6} fontFamily="var(--mono)">E</text>
        {/* Wind arrow — pointing WSW (250°) */}
        <line x1={36} y1={36} x2={20} y2={44} stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        <polygon points="14,46 24,38 22,50" fill="#38bdf8" />
        {/* Center dot */}
        <circle cx={36} cy={36} r={3} fill="var(--bg3)" stroke="var(--border2)" strokeWidth="1" />
      </svg>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted)' }}>250° · 12 km/h</span>
    </div>
  )
}

function PreviewSectorMap() {
  return (
    <div style={{ width: '100%', height: '100%', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 130 78" style={{ width: '100%', height: '100%' }}>
        {/* Full track outline (ghost) */}
        <path
          d="M20 40 Q20 16 44 12 L84 10 Q106 8 112 24 L114 40 Q114 58 96 64 L46 66 Q22 64 20 50 Z"
          fill="none" stroke="var(--border)" strokeWidth="3" strokeLinecap="round"
        />
        {/* S1 — top-left */}
        <path d="M20 40 Q20 16 44 12 L70 10" fill="none" stroke="#eab308" strokeWidth="4" strokeLinecap="round" />
        {/* S2 — top-right + right side */}
        <path d="M70 10 L84 10 Q106 8 112 24 L114 40" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
        {/* S3 — bottom */}
        <path d="M114 40 Q114 58 96 64 L46 66 Q22 64 20 50 L20 40" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
        {/* Driver dot */}
        <circle cx={96} cy={62} r={5} fill="var(--bg3)" />
        <circle cx={96} cy={62} r={3.5} fill="#f97316" />
        {/* Sector labels */}
        <text x={26} y={22} fill="#eab308" fontSize={7} fontFamily="var(--mono)" fontWeight="700">S1</text>
        <text x={98} y={22} fill="#22c55e" fontSize={7} fontFamily="var(--mono)" fontWeight="700">S2</text>
        <text x={60} y={74} fill="#ef4444" fontSize={7} fontFamily="var(--mono)" fontWeight="700">S3</text>
      </svg>
    </div>
  )
}

function PreviewOvertakeReplay() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
      <div style={{ position: 'relative', height: 16 }}>
        <div style={{ position: 'absolute', left: 8, top: 7, width: 36, height: 3, background: '#3b82f6', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 38, top: 7, width: 36, height: 3, background: '#f97316', borderRadius: 2 }} />
        <span style={{ position: 'absolute', left: 32, top: 0, fontFamily: 'var(--mono)', fontSize: 10, color: '#22c55e' }}>↗</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: '46%', height: '100%', background: 'var(--red)' }} />
      </div>
    </div>
  )
}

function PreviewRadioScanner() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${35 + row * 15}%`, height: '100%', background: '#ec4899' }} />
        </div>
      ))}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>CH 04 ACTIVE</span>
    </div>
  )
}

function PreviewRadioFeedText() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {['BOX THIS LAP', 'TYRES GOOD', 'COPY, PUSH NOW'].map((line, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 4 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>14:{22 + i}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted)' }}>{line}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewStandingsTable() {
  const rows = ['1 NOR 250', '2 VER 238', '3 LEC 191', '4 HAM 180']
  return (
    <div style={{ height: '100%', padding: '7px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 26px', fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>
        <span>DRIVER</span>
        <span>PTS</span>
      </div>
      {rows.map((row) => (
        <div key={row} style={{ display: 'grid', gridTemplateColumns: '1fr 26px', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--white)' }}>{row.slice(0, 7)}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted)' }}>{row.slice(-3)}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewChampionshipCalculator() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 2, border: '0.5px solid var(--border)', padding: '4px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>NOR</span>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--white)' }}>+18</div>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 2, border: '0.5px solid var(--border)', padding: '4px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'var(--muted2)' }}>VER</span>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--white)' }}>+15</div>
        </div>
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 6, color: '#86efac' }}>TITLE SWING +3</span>
    </div>
  )
}

function PreviewPointsDeltaTracker() {
  return (
    <div style={{ height: '100%', padding: '8px' }}>
      <svg viewBox="0 0 120 72" style={{ width: '100%', height: '100%' }}>
        <line x1={4} y1={36} x2={116} y2={36} stroke="var(--border)" strokeWidth="1" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" points="4,42 20,38 36,34 52,30 68,26 84,22 100,18 116,14" />
      </svg>
    </div>
  )
}

function PreviewCarVisualization() {
  return (
    <div style={{ height: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 130 72" style={{ width: '100%', height: '100%' }}>
        <rect x={20} y={30} width={80} height={12} rx={4} fill="#3b82f6" opacity={0.8} />
        <rect x={40} y={24} width={28} height={8} rx={2} fill="#60a5fa" />
        <circle cx={30} cy={48} r={8} fill="#111" />
        <circle cx={84} cy={48} r={8} fill="#111" />
        <line x1={20} y1={20} x2={110} y2={20} stroke="var(--border2)" strokeWidth="1" strokeDasharray="3 2" />
      </svg>
    </div>
  )
}

const PREVIEW_MAP: Record<string, () => React.ReactElement> = {
  LapDeltaTower: PreviewLapDeltaTower,
  LastLapCard: PreviewLastLapCard,
  LiveLapTimeCard: PreviewLiveLapTimeCard,
  GapEvolutionChart: PreviewGapEvolutionChart,
  StintPaceComparison: PreviewStintPaceComparison,
  HeadToHeadDelta: PreviewHeadToHeadDelta,
  SectorMiniCards: PreviewSectorMiniCards,
  SpeedGauge: PreviewSpeedGauge,
  ThrottleBrakeTrace: PreviewThrottleBrakeTrace,
  GearTrace: PreviewGearTrace,
  ThrottleHeatmap: PreviewThrottleHeatmap,
  ERSMicroSectors: PreviewERSMicroSectors,
  DRSEfficiency: PreviewDRSEfficiency,
  EngineModeTracker: PreviewEngineModeTracker,
  RunningOrderStrip: PreviewRunningOrderStrip,
  RaceControlFeed: PreviewRaceControlFeed,
  StrategyTimeline: PreviewStrategyTimeline,
  DegRateGraph: PreviewDegRateGraph,
  PitWindowUrgency: PreviewPitWindowUrgency,
  PitStopLog: PreviewPitStopLog,
  UndercutSimulator: PreviewUndercutSimulator,
  WeatherDashboard: PreviewWeatherDashboard,
  TrackTempEvolution: PreviewTrackTempEvolution,
  WindDirection: PreviewWindDirection,
  TyreIntelligence: PreviewTyreIntelligence,
  FullTrackMap: PreviewFullTrackMap,
  SectorMap: PreviewSectorMap,
  OvertakeReplay: PreviewOvertakeReplay,
  WeatherRadar: PreviewWeatherRadar,
  RadioScanner: PreviewRadioScanner,
  RadioFeedText: PreviewRadioFeedText,
  StandingsBoard: PreviewStandingsBoard,
  StandingsTable: PreviewStandingsTable,
  ChampionshipCalculator: PreviewChampionshipCalculator,
  PointsDeltaTracker: PreviewPointsDeltaTracker,
  CarVisualization: PreviewCarVisualization,
}

function WidgetCard({
  widget,
  onAdd,
  onClose,
  index,
  registerRef,
}: {
  widget: WidgetDef
  onAdd: (type: string) => void
  onClose: () => void
  index: number
  registerRef?: (type: string, node: HTMLDivElement | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const setDraggingType = useDraggingStore((s) => s.setDraggingType)
  const dragPreviewRef = useRef<HTMLCanvasElement | null>(null)

  const PreviewComponent = PREVIEW_MAP[widget.type]
  const category = getWidgetCategory(widget.type)
  const categoryColor = CATEGORY_COLORS[category]
  const initials = getWidgetInitials(widget.label)

  function handleClick() {
    onAdd(widget.type)
    onClose()
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', widget.type)

    const previewSize = getDragPreviewDimensions(widget.type)
    const previewColor = resolveCssColor(widget.color, '#e8132b')
    const preview = createCanvasDragImage(
      `${widget.label} (${previewSize.w}x${previewSize.h})`,
      previewColor,
      previewSize.width,
      previewSize.height,
    )
    preview.style.position = 'fixed'
    preview.style.top = '-9999px'
    preview.style.left = '-9999px'
    preview.style.pointerEvents = 'none'
    document.body.appendChild(preview)
    dragPreviewRef.current = preview
    e.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2)

    emitPickerDragHover(false)
    setDraggingType(widget.type)
    setDragging(true)
  }

  function handleDragEnd() {
    emitPickerDragHover(false)
    setDraggingType(null)
    setDragging(false)
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove()
      dragPreviewRef.current = null
    }
  }

  return (
    <div
      ref={(node) => registerRef?.(widget.type, node)}
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
        width: '100%',
        maxWidth: 130,
        minWidth: 0,
        height: 120,
        background: 'var(--bg4)',
        border: `0.5px solid ${categoryColor}`,
        borderRadius: 4,
        overflow: 'hidden',
        boxSizing: 'border-box',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        opacity: dragging ? 0.6 : 1,
        transition: 'box-shadow 0.12s, opacity 0.1s',
        boxShadow: hovered ? `0 0 0 0.5px ${categoryColor}` : 'none',
        flexShrink: 0,
        willChange: 'transform, opacity',
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
            background: `linear-gradient(145deg, ${widget.color}22, var(--bg3))`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: `${widget.color}44`,
                border: `0.5px solid ${widget.color}99`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: 'var(--white)',
                }}
              >
                {initials}
              </span>
            </div>
            <span
              style={{
                position: 'absolute',
                left: 6,
                bottom: 5,
                fontFamily: 'var(--mono)',
                fontSize: 6,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
              }}
            >
              {category}
            </span>
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
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const prevCardRectsRef = useRef(new Map<string, DOMRect>())
  const draggingType = useDraggingStore((s) => s.draggingType)

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
          w.description.toLowerCase().includes(query.toLowerCase()) ||
          getWidgetCategory(w.type).toLowerCase().includes(query.toLowerCase())
      )
    : WIDGETS

  const groupedWidgets = CATEGORY_ORDER
    .map((category) => ({
      category,
      widgets: filtered.filter((widget) => getWidgetCategory(widget.type) === category),
    }))
    .filter((group) => group.widgets.length > 0)

  const visibleWidgetTypes = groupedWidgets.flatMap((group) => group.widgets.map((widget) => widget.type))

  function registerCardRef(type: string, node: HTMLDivElement | null) {
    if (!node) {
      cardRefs.current.delete(type)
      return
    }
    cardRefs.current.set(type, node)
  }

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>()

    for (const type of visibleWidgetTypes) {
      const el = cardRefs.current.get(type)
      if (!el) continue
      nextRects.set(type, el.getBoundingClientRect())
    }

    for (const [type, nextRect] of nextRects) {
      const el = cardRefs.current.get(type)
      if (!el) continue

      const prevRect = prevCardRectsRef.current.get(type)
      if (!prevRect) {
        // New card: fade/scale in quickly to avoid a hard pop.
        el.style.transition = 'none'
        el.style.opacity = '0'
        el.style.transform = 'scale(0.96)'
        requestAnimationFrame(() => {
          el.style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease'
          el.style.opacity = '1'
          el.style.transform = 'translate(0, 0) scale(1)'
        })
        continue
      }

      const deltaX = prevRect.left - nextRect.left
      const deltaY = prevRect.top - nextRect.top

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue

      // Existing card: FLIP transform for smooth reflow.
      el.style.transition = 'none'
      el.style.transform = `translate(${deltaX}px, ${deltaY}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        el.style.transform = 'translate(0, 0)'
      })
    }

    prevCardRectsRef.current = nextRects
  }, [visibleWidgetTypes.join('|')])

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleRequestClose}
        className={isClosing ? 'glass-overlay glass-overlay-exit' : 'glass-overlay'}
        style={{
          position: 'fixed',
          inset: 0,
          background: draggingType ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.35)',
          zIndex: 200,
          pointerEvents: draggingType ? 'none' : 'auto',
          backdropFilter: draggingType ? 'none' : undefined,
          WebkitBackdropFilter: draggingType ? 'none' : undefined,
          transition: 'background 170ms ease, backdrop-filter 170ms ease, -webkit-backdrop-filter 170ms ease',
        }}
      />

      {/* Slide-in panel */}
      <div
        className={isClosing ? 'animated-slide-right-exit' : 'animated-slide-right'}
        onDragEnter={(e) => {
          // Explicitly consume drag events over the picker so the canvas drop preview clears.
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'none'
          emitPickerDragHover(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'none'
          emitPickerDragHover(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          emitPickerDragHover(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          emitPickerDragHover(false)
        }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 312,
          background: 'var(--bg3)',
          borderLeft: '0.5px solid var(--border2)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
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
        <SmoothScrollContainer style={{ flex: 1, overflowX: 'hidden' }} innerStyle={{ padding: '8px 18px 16px 14px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groupedWidgets.map((group, groupIndex) => (
                <section
                  key={group.category}
                  className="reveal-grow"
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 8,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: CATEGORY_COLORS[group.category],
                      marginBottom: 8,
                      paddingBottom: 4,
                      borderBottom: `0.5px solid ${CATEGORY_COLORS[group.category]}`,
                    }}
                  >
                    {group.category}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 10,
                      justifyItems: 'stretch',
                    }}
                  >
                    {group.widgets.map((widget, index) => (
                      <WidgetCard
                        key={widget.type}
                        widget={widget}
                        onAdd={onAdd}
                        onClose={handleRequestClose}
                        index={groupIndex * 10 + index}
                        registerRef={registerCardRef}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </SmoothScrollContainer>
      </div>
    </>,
    document.body
  )
}
