import type { FlagState } from '../../store/ambientStore'

// Priority: lower number = higher priority
export const FLAG_PRIORITY: Record<FlagState, number> = {
  RED: 1,
  SAFETY_CAR: 2,
  VIRTUAL_SC: 3,
  YELLOW: 4,
  FASTEST_LAP: 5,
  CHECKERED: 6,
  GREEN: 7,
  WAITING_FOR_START: 8,
  NATIONAL_ANTHEM: 9,
  CALM: 10,
  NONE: 11,
}

export interface FlagColors {
  background: string
  glow: string
  text: string
  flagColor: string
  pulse: boolean
  pulseHz: number
  /** Initial pulse window in milliseconds; when elapsed the flag settles to solid. */
  pulseBurstMs: number
  /** Whether this flag state should show a sweeping wave shimmer */
  flagWave: boolean
  /** Wave cycle duration in seconds (only relevant when flagWave is true) */
  waveSpeed: number
  /** Per-blob color palette for the wave effect (cycles across the 6 blobs) */
  waveColors: string[]
}

export const FLAG_COLORS: Record<FlagState, FlagColors> = {
  RED: {
    background: '#1a0404',
    glow: '#FF1E1E',
    text: '#FF6060',
    flagColor: '#FF1E1E',
    pulse: true,
    pulseHz: 1,
    pulseBurstMs: 3000,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
  SAFETY_CAR: {
    background: '#110d00',
    glow: '#FFA500',
    text: '#FFB830',
    flagColor: '#FFA500',
    pulse: true,
    pulseHz: 0.5,
    pulseBurstMs: 4000,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
  VIRTUAL_SC: {
    background: '#100a00',
    glow: '#E09000',
    text: '#E09000',
    flagColor: '#E09000',
    pulse: true,
    pulseHz: 0.5,
    pulseBurstMs: 3000,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
  YELLOW: {
    background: '#1a1500',
    glow: '#FFD600',
    text: '#FFE566',
    flagColor: '#FFD600',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: true,
    waveSpeed: 2.4,
    // Pure yellow → deep amber → bright gold → orange-amber → light yellow → mid-gold
    waveColors: ['#FFD600', '#FF8F00', '#FFD740', '#FFAB00', '#FFF176', '#FFEE58'],
  },
  FASTEST_LAP: {
    background: '#100b1a',
    glow: '#9B59F5',
    text: '#C89BFF',
    flagColor: '#9B59F5',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
  CHECKERED: {
    background: '#111110',
    glow: '#F0EEE8',
    text: '#F0EEE8',
    flagColor: '#F0EEE8',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: true,
    waveSpeed: 1.8,
    // Bright white → dark grey → warm white → mid grey → off-white → deep grey
    waveColors: ['#FFFFFF', '#484846', '#F0EEE8', '#909088', '#D8D6D0', '#282826'],
  },
  GREEN: {
    background: '#0a1a0e',
    glow: '#00C850',
    text: '#4EFF8A',
    flagColor: '#00C850',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
  WAITING_FOR_START: {
    background: '#0b1317',
    glow: '#5f88a6',
    text: '#9cb6c7',
    flagColor: '#5f88a6',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: true,
    waveSpeed: 5.2,
    // Cool, low-energy fallback palette. AmbientRaceLayer can override per-track.
    waveColors: ['#4a6074', '#587189', '#6a859d', '#51697f', '#7c96ad', '#4f6679'],
  },
  NATIONAL_ANTHEM: {
    background: '#111016',
    glow: '#8f86ad',
    text: '#c5bdd9',
    flagColor: '#8f86ad',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: true,
    waveSpeed: 4.4,
    // Soft ceremonial palette. AmbientRaceLayer can override per-track.
    waveColors: ['#6b6383', '#83799d', '#595171', '#9488ad', '#6f6788', '#544c6c'],
  },
  CALM: {
    background: '#101010',
    glow: '#EDE8DC',
    text: '#EDE8DC',
    flagColor: '#EDE8DC',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
  NONE: {
    background: 'var(--bg2)',
    glow: 'transparent',
    text: 'var(--muted)',
    flagColor: 'transparent',
    pulse: false,
    pulseHz: 0,
    pulseBurstMs: 0,
    flagWave: false,
    waveSpeed: 0,
    waveColors: [],
  },
}

export function getFlagLabel(state: FlagState): string {
  switch (state) {
    case 'RED': return 'Red flag — race suspended'
    case 'SAFETY_CAR': return 'Safety car deployed'
    case 'VIRTUAL_SC': return 'Virtual safety car'
    case 'YELLOW': return 'Yellow flag'
    case 'FASTEST_LAP': return 'Fastest lap'
    case 'CHECKERED': return 'Chequered flag'
    case 'GREEN': return 'Green flag — racing'
    case 'WAITING_FOR_START': return 'Waiting for race start'
    case 'NATIONAL_ANTHEM': return 'National anthem'
    case 'CALM': return 'Calm mode'
    case 'NONE': return '—'
  }
}

export function getTransitionDuration(state: FlagState): string {
  switch (state) {
    case 'RED': return '0.3s'
    case 'SAFETY_CAR': return '0.6s'
    case 'VIRTUAL_SC': return '0.8s'
    case 'YELLOW': return '0.8s'
    case 'FASTEST_LAP': return '0.3s'
    case 'CHECKERED': return '1.0s'
    case 'GREEN': return '1.2s'
    case 'WAITING_FOR_START': return '1.6s'
    case 'NATIONAL_ANTHEM': return '1.8s'
    case 'CALM': return '2.0s'
    default: return '1.2s'
  }
}
