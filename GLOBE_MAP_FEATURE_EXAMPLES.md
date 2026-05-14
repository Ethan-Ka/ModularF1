# Globe Map - Implementation Examples for Premium Features

## 1. Hover Tooltip Example

### What It Would Look Like
```
Circuit Name: SUZUKA
Country: JAPAN
Next Session: Q - Qualifying in 2:47
───────────────────────────
Historical Winners (Last 3):
  2024 — Max Verstappen
  2023 — Carlos Sainz
  2022 — Max Verstappen

Sector Characteristics:
  S1: High-speed (130R) ⚡
  S2: Technical Corners 🎯
  S3: Drag Zone 🔥

Qualifying vs Race Pace: -1.8s avg
───────────────────────────
🏆 Last Championship: Lewis Hamilton (2008)
```

### Implementation Hook
```typescript
const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lng: number } | null>(null)

// In GlobeView component, add:
pointsData={pointsData.map(p => ({
  ...p, 
  onHover: () => setHoveredPoint(p),
  onUnhover: () => setHoveredPoint(null)
}))}

// Render tooltip
{hoveredPoint && (
  <Tooltip 
    circuit={CIRCUIT_COORDS.find(c => c.lat === hoveredPoint.lat)}
    style={{ 
      position: 'fixed',
      top: hoveredPoint.screenY, 
      left: hoveredPoint.screenX,
      background: 'rgba(15,20,30,0.92)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(232,19,43,0.3)'
    }}
  />
)}
```

---

## 2. Circuit Comparison Mode Example

### Data Structure
```typescript
interface CircuitComparison {
  circuit1: {
    name: string
    terrain: string
    downforceRequirement: 'Low' | 'Medium' | 'High'
    overtakingDifficulty: number // 1-5
    historicalWinnerNationality: string
    safetyCarFrequency: number
  }
  circuit2: { /* same */ }
  differences: string[]
}
```

### Usage
```typescript
const [comparisonMode, setComparisonMode] = useState(false)
const [selectedCircuits, setSelectedCircuits] = useState<[string, string] | null>(null)

// Compare Suzuka vs Abu Dhabi
const comparison = {
  circuit1: {
    name: 'SUZUKA',
    terrain: 'Mountain circuit with Esses',
    downforceRequirement: 'High',
    overtakingDifficulty: 4,
    historicalWinnerNationality: 'Japanese',
    safetyCarFrequency: 2.1
  },
  circuit2: {
    name: 'ABU DHABI',
    terrain: 'Desert island circuit',
    downforceRequirement: 'Low',
    overtakingDifficulty: 2,
    historicalWinnerNationality: 'Dutch',
    safetyCarFrequency: 1.8
  }
}

// Render split-screen comparison
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
  <CircuitCard circuit={comparison.circuit1} side="left" />
  <CircuitCard circuit={comparison.circuit2} side="right" />
  <ComparisonMetrics diff={comparison.differences} />
</div>
```

---

## 3. Difficulty Heatmap Example

### Data Extraction from Challenges
```typescript
type CircuitDifficulty = {
  circuit: string
  overallRating: number // 1-10
  challenges: Array<{
    name: string
    severity: number // 1-10
    icon: string
  }>
}

const DIFFICULTY_MAP: CircuitDifficulty[] = [
  {
    circuit: 'Monaco',
    overallRating: 9.5,
    challenges: [
      { name: 'No Run-off', severity: 10, icon: '⚠️' },
      { name: 'Street Grip', severity: 9, icon: '🚗' },
      { name: 'One Mistake = DNF', severity: 10, icon: '💥' }
    ]
  },
  {
    circuit: 'Abu Dhabi',
    overallRating: 5.0,
    challenges: [
      { name: 'Predictable', severity: 2, icon: '📋' },
      { name: 'Overtaking Friendly', severity: 8, icon: '🔄' },
      { name: 'Modern Design', severity: 3, icon: '🏗️' }
    ]
  }
]
```

### Visualization
```typescript
function DifficultyHeatmap({ circuits }: { circuits: CircuitDifficulty[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
      {circuits.map(c => (
        <div
          key={c.circuit}
          style={{
            background: `hsl(0, 100%, ${100 - c.overallRating * 5}%)`,
            padding: '8px 12px',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onHover={() => showChallenges(c.challenges)}
        >
          <div style={{ fontWeight: 700 }}>{c.circuit}</div>
          <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
            Difficulty: {c.overallRating}/10
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## 4. Constructor HQ Overlay Example

### Toggle Implementation
```typescript
const [showConstructorHQ, setShowConstructorHQ] = useState(false)

// Add HQ data to globe when toggled
const hqData = useMemo(() => {
  if (!showConstructorHQ) return []
  
  return Object.entries(CONSTRUCTOR_HQ).map(([key, hq]) => ({
    lat: hq.lat,
    lng: hq.lng,
    altitude: 0.08,
    text: hq.name,
    type: 'constructor',
    titles: hq.titles,
    color: getTeamColor(key)
  }))
}, [showConstructorHQ])

// Distance calculation from circuit to nearest HQ
function distanceToHQ(circuit: string): { team: string; km: number } {
  const circuitCoord = CIRCUIT_COORDS[circuit]
  let nearest = { team: '', km: Infinity }
  
  Object.entries(CONSTRUCTOR_HQ).forEach(([team, hq]) => {
    const km = haversineKm(circuitCoord, { lat: hq.lat, lng: hq.lng })
    if (km < nearest.km) nearest = { team, km }
  })
  
  return nearest
}
```

---

## 5. Season Timeline Scrubber Example

### State & Controls
```typescript
const [timelineYear, setTimelineYear] = useState(new Date().getFullYear())
const [scrubberPos, setScrubberPos] = useState(0) // 0-1, progress through year

// Replay milestones chronologically
const filteredMilestones = useMemo(() => {
  const progress = scrubberPos * 12 // months
  return Object.entries(CIRCUIT_MILESTONES)
    .filter(([_, moments]) => {
      const avgYear = moments.reduce((sum, m) => sum + m.year, 0) / moments.length
      return Math.abs(avgYear - timelineYear) < 0.5
    })
    .sort(([_, m1], [__, m2]) => {
      // Sort by implied race calendar order
      return m1[0].localeCompare(m2[0])
    })
}, [timelineYear, scrubberPos])

// Slider component
<input
  type="range"
  min="0"
  max="100"
  value={scrubberPos * 100}
  onChange={(e) => setScrubberPos(Number(e.target.value) / 100)}
  style={{
    width: '100%',
    cursor: 'pointer',
    appearance: 'none',
    background: `linear-gradient(to right, 
      rgba(232,19,43,0.6) 0%, 
      rgba(232,19,43,0.6) ${scrubberPos * 100}%, 
      rgba(255,255,255,0.1) ${scrubberPos * 100}%,
      rgba(255,255,255,0.1) 100%)`
  }}
/>
```

---

## 6. Circuit Type Filter Example

### Implementation
```typescript
type CircuitTypeFilter = 'all' | 'permanent' | 'street' | 'semi-permanent'
const [typeFilter, setTypeFilter] = useState<CircuitTypeFilter>('all')

// Filter circuits on globe
const filteredPointsData = useMemo(() =>
  pointsData.filter(p => {
    if (typeFilter === 'all') return true
    const circuit = weekends.find(w => w.circuitShort === p.circuit)
    const meta = CIRCUIT_META[circuit?.circuitShort ?? '']
    return meta?.type === typeFilter
  }),
  [pointsData, typeFilter, weekends]
)

// Filter with smooth animation
<div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
  {(['all', 'permanent', 'street', 'semi-permanent'] as const).map(type => (
    <button
      key={type}
      onClick={() => setTypeFilter(type)}
      style={{
        padding: '6px 12px',
        borderRadius: 4,
        border: `1px solid ${typeFilter === type ? 'rgba(232,19,43,0.8)' : 'rgba(255,255,255,0.1)'}`,
        background: typeFilter === type ? 'rgba(232,19,43,0.15)' : 'transparent',
        color: typeFilter === type ? 'rgba(232,19,43,0.9)' : 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--mono)',
        fontSize: 7,
        letterSpacing: '0.1em',
        textTransform: 'uppercase'
      }}
    >
      {type === 'all' ? '🌍 All' : type === 'street' ? '🏙️ Street' : type === 'permanent' ? '🏛️ Permanent' : '🏗️ Semi-Perm'}
    </button>
  ))}
</div>
```

---

## 7. Distance Calculator Example

### Interactive Mode
```typescript
const [distanceMode, setDistanceMode] = useState(false)
const [selectedForDistance, setSelectedForDistance] = useState<string[]>([])

// Click handler
const handlePointClick = (circuitShort: string) => {
  if (!distanceMode) return
  
  if (selectedForDistance.length === 0) {
    setSelectedForDistance([circuitShort])
  } else if (selectedForDistance.length === 1 && selectedForDistance[0] !== circuitShort) {
    const d = calculateDistance(selectedForDistance[0], circuitShort)
    setSelectedForDistance([circuitShort]) // reset
    showDistanceResult(d) // show modal or toast
  }
}

function calculateDistance(circuit1: string, circuit2: string) {
  const c1 = CIRCUIT_COORDS[circuit1]
  const c2 = CIRCUIT_COORDS[circuit2]
  if (!c1 || !c2) return null
  
  const km = haversineKm(c1, c2)
  const flightTime = (km / 900) // 900 km/h average flight speed
  
  return {
    circuit1, circuit2,
    distance: km,
    flightHours: flightTime.toFixed(1),
    flyingCost: Math.round(km * 1.5) // $/km estimate
  }
}

// Result display
function DistanceResult({ result }: { result: ReturnType<typeof calculateDistance> }) {
  return (
    <div style={{
      background: 'rgba(15,20,30,0.95)',
      border: '1px solid rgba(232,19,43,0.3)',
      padding: 16,
      borderRadius: 4,
      fontFamily: 'var(--mono)'
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', marginBottom: 8 }}>
        {result.circuit1} → {result.circuit2}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(232,19,43,0.9)', marginBottom: 4 }}>
        {result.distance.toLocaleString()} km
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
        ✈️ {result.flightHours}h flight | ~${result.flyingCost.toLocaleString()} charter estimate
      </div>
    </div>
  )
}
```

---

## Implementation Priority Matrix

```
IMPACT      │ High              │ Medium           │ Low
────────────┼──────────────────┼────────────────┼────────
EFFORT LOW  │ Hover Tooltips   │ Environment    │ Medal
            │ Type Filter      │ Toggle         │ Pins
────────────┼──────────────────┼────────────────┼────────
EFFORT MED  │ Circuit Compare  │ Difficulty     │ HQ 
            │ Timeline         │ Heatmap        │ Overlay
────────────┼──────────────────┼────────────────┼────────
EFFORT HI   │ Analytics DB     │ Tier/Ranking   │ AR Mode
            │ Historical Data  │ System         │ (Future)
```

---

## Testing Checklist for Each Feature

- [ ] Data loads without errors
- [ ] Responsive to window resize
- [ ] Animations smooth (60fps)
- [ ] Accessibility (keyboard nav, screen reader)
- [ ] Mobile/touch friendly
- [ ] No console warnings
- [ ] Performance: <100ms interaction response
- [ ] Styling matches design system (colors, typography)
