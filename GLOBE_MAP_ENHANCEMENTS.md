# Globe Map Enhancements

## Current Features
- 3D globe with country borders
- Race circuit locations as points
- Connection lines between consecutive races
- Nearby city labels
- Pulse beacon for next race
- Circuit metadata (laps, km, turns, DRS)
- Circuit history, lap records, notable facts

---

## PROPOSED PREMIUM INTERACTION FEATURES

### 1. **Interactive Point Hover → Rich Tooltip**
- On hover, show expanded tooltip with:
  - Circuit name & country
  - Next session time countdown
  - Historical winners (last 3 years)
  - Sector highlights (if applicable)
  - Estimated qualifying pace vs. race pace
  - **Premium feel**: Glassmorphic tooltip with smooth blur backdrop

### 2. **Circuit Comparison Mode**
- Click-to-select two circuits, display side-by-side comparison overlay:
  - Track characteristics (downforce, braking, corners)
  - Altitude & weather patterns
  - Historical stats (avg. winner speed, safety car frequency, overtaking difficulty)
  - Design architect (Tilke vs. permanent vs. street circuits)
  - **Premium feel**: Animated transition with split-screen divide

### 3. **Track Difficulty Heatmap**
- Visual gradient showing difficulty per corner (based on historical incidents/penalties)
- Clickable corners show incident data
- **Premium feel**: Smooth animation on focus, with glow effects

### 4. **Constructor Headquarters Overlay**
- Overlay showing HQ locations of F1 teams relative to races
- Show distance from HQ to each circuit
- **Premium feel**: Subtle pin markers with team colors, animated on demand

### 5. **Season Timeline Scrubber**
- Interactive slider or calendar showing race progression through season
- Replay mode: animate the calendar backwards/forwards through the year
- **Premium feel**: Smooth camera pan across globe as time moves

### 6. **Qualifying vs. Race Pace Filter**
- Toggle filter to show average pole speed vs. race winner speed
- Visual indicator of circuits where pace differentials are largest
- **Premium feel**: Smooth color transition between modes

### 7. **Weather Pattern Visualization**
- Show typical weather patterns for each circuit (monsoon, desert, alpine storms)
- Animated rain/wind indicators on demand
- **Premium feel**: Subtle particle effects that respond to globe rotation

### 8. **Circuit Type Filtering**
- Filter globe to show only street circuits, permanent tracks, or semi-permanent circuits
- Smooth fade-in/out transitions
- **Premium feel**: Categorized color coding with glow effects

### 9. **Historical Winner Medal Pins**
- Show championship-deciding races and add small medal pins
- Hover to see which driver won their title
- **Premium feel**: 3D rotating medal badges with shadow

### 10. **Distance Calculator**
- Click two circuits to measure great-circle distance between them
- Show travel time estimate if teams fly between races
- **Premium feel**: Animated geodesic line with distance display

---

## IMPLEMENTED CONTENT ADDITIONS

### 1. **Altitude Visualization**
- Already added to `CIRCUIT_ALT` mapping
- Drives camera altitude for each circuit

### 2. **Circuit Type Classification** 
- Added `type` field: 'permanent' | 'street' | 'semi-permanent'
- Color-coded badges on circuit cards

### 3. **Extended Circuit History**
- **`since`**: Year circuit first hosted F1
- **`gps`**: Number of times F1 has visited
- **`lapRecord`**: Fastest lap with driver & year
- **`about`**: Circuit characteristics description
- **`notable`**: Historical or championship-deciding facts
- **`altitudeM`**: Precise altitude for technical conditions
- **`weather`**: Typical weather patterns

### 4. **Nearby City Labels**
- 3-4 major nearby cities/landmarks for each circuit
- Renders on globe to provide geographic context

### 5. **Distance Tracking**
- Calculates total km traveled so far in season
- Updates as races progress

### 6. **Circuit Stats Expansion**
- Added total distance (`LAPS × KM`)
- Altitude display for high-altitude circuits

### 7. **Visual Hierarchy Indicators**
- Race progress indicator (R## / ##)
- Session type chips with color coding
- "GO LIVE" indicator for imminent races

---

## Next Steps for Implementation
- Choose 2-3 premium features to implement first
- Start with #1 (Hover Tooltips) as foundation for others
- Build #8 (Filtering) as content-only feature
- Implement #9 (Medal Pins) for championship moments
