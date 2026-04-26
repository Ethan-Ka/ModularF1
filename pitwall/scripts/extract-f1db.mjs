#!/usr/bin/env node
// Reads public/seasons/2026/f1db/f1db-sql-mysql.sql and emits JSON files
// to public/seasons/f1db/ for client-side consumption.

import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SQL_FILE = path.join(ROOT, 'public/seasons/2026/f1db/f1db-sql-mysql.sql')
const OUT_DIR = path.join(ROOT, 'public/seasons/f1db')

const CURRENT_YEAR = 2026
const WANTED = new Set(['driver', 'season_driver_standing', 'season_entrant_driver', 'constructor', 'race', 'race_data'])

// ── SQL parsing ──────────────────────────────────────────────────────────────

function extractTableName(line) {
  const m = line.match(/^INSERT INTO `([^`]+)`/)
  return m ? m[1] : null
}

function extractColumns(line) {
  const m = line.match(/INSERT INTO `[^`]+` \(([^)]+)\)/)
  if (!m) return null
  return m[1].split(',').map(c => c.trim().replace(/`/g, ''))
}

// Parse a VALUES tuple string of the form "(val1, val2, ...)"
// Handles: NULL, TRUE/FALSE, DATE 'YYYY-MM-DD', 'string', numbers
function parseValues(tupleStr) {
  const inner = tupleStr.slice(1, -1) // strip outer parens
  const values = []
  let i = 0

  while (i < inner.length) {
    while (i < inner.length && (inner[i] === ' ' || inner[i] === ',')) i++
    if (i >= inner.length) break

    if (inner.startsWith('NULL', i)) {
      values.push(null); i += 4
    } else if (inner.startsWith('TRUE', i)) {
      values.push(true); i += 4
    } else if (inner.startsWith('FALSE', i)) {
      values.push(false); i += 5
    } else if (inner.startsWith("DATE '", i)) {
      i += 6
      const end = inner.indexOf("'", i)
      values.push(inner.slice(i, end))
      i = end + 1
    } else if (inner[i] === "'") {
      i++
      let s = ''
      while (i < inner.length) {
        if (inner[i] === "'" && inner[i + 1] === "'") { s += "'"; i += 2 }
        else if (inner[i] === "'") break
        else { s += inner[i++] }
      }
      i++ // skip closing quote
      values.push(s)
    } else {
      let j = i
      while (j < inner.length && inner[j] !== ',') j++
      const raw = inner.slice(i, j).trim()
      const num = Number(raw)
      values.push(Number.isFinite(num) ? num : raw)
      i = j
    }
  }
  return values
}

function rowFromLine(line) {
  const cols = extractColumns(line)
  if (!cols) return null
  const valIdx = line.indexOf('VALUES ')
  if (valIdx === -1) return null
  const tupleStr = line.slice(valIdx + 7).replace(/;$/, '').trim()
  const vals = parseValues(tupleStr)
  const row = {}
  for (let i = 0; i < cols.length; i++) row[cols[i]] = vals[i]
  return row
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const drivers = new Map()         // f1db id → driver row
  const constructorNames = new Map() // constructor id → name
  const seasonStandings = []
  const entrantDrivers = []
  const races = new Map()           // race id → {year, round, grandPrixId, date}
  const raceResults = []            // {raceId, driverId, position, points}

  let totalLines = 0

  const rl = createInterface({ input: createReadStream(SQL_FILE), crlfDelay: Infinity })

  for await (const line of rl) {
    totalLines++
    if (!line.startsWith('INSERT INTO `')) continue

    const tableName = extractTableName(line)
    if (!tableName || !WANTED.has(tableName)) continue

    // Quick pre-filter for the massive race_data table
    if (tableName === 'race_data' && !line.includes("'RACE_RESULT'")) continue

    const row = rowFromLine(line)
    if (!row) continue

    switch (tableName) {
      case 'driver':
        drivers.set(row.id, row)
        break
      case 'constructor':
        constructorNames.set(row.id, row.name)
        break
      case 'season_driver_standing':
        seasonStandings.push(row)
        break
      case 'season_entrant_driver':
        if (!row.test_driver) entrantDrivers.push(row)
        break
      case 'race':
        races.set(row.id, { year: row.year, round: row.round, grandPrixId: row.grand_prix_id, date: row.date })
        break
      case 'race_data':
        if (row.type === 'RACE_RESULT' && row.position_number != null) {
          raceResults.push({
            raceId: row.race_id,
            driverId: row.driver_id,
            position: Number(row.position_number),
            points: Number(row.race_points ?? 0),
          })
        }
        break
    }
  }

  console.log(`Parsed ${totalLines} lines`)
  console.log(`  drivers: ${drivers.size}, constructors: ${constructorNames.size}`)
  console.log(`  season standings: ${seasonStandings.length}, entrant drivers: ${entrantDrivers.length}`)
  console.log(`  races: ${races.size}, race results (RACE_RESULT): ${raceResults.length}`)

  // ── Wins per driver per year ────────────────────────────────────────────────
  const winsMap = new Map() // `${year}:${driverId}` → count
  for (const r of raceResults) {
    if (r.position !== 1) continue
    const race = races.get(r.raceId)
    if (!race) continue
    const key = `${race.year}:${r.driverId}`
    winsMap.set(key, (winsMap.get(key) ?? 0) + 1)
  }

  // ── Max round per year ──────────────────────────────────────────────────────
  const maxRoundByYear = new Map()
  for (const r of races.values()) {
    const cur = maxRoundByYear.get(r.year) ?? 0
    if (r.round > cur) maxRoundByYear.set(r.year, r.round)
  }

  // ── Teams per driver per season ─────────────────────────────────────────────
  const teamsMap = new Map() // `${year}:${driverId}` → Set<constructorId>
  for (const e of entrantDrivers) {
    const key = `${e.year}:${e.driver_id}`
    if (!teamsMap.has(key)) teamsMap.set(key, new Set())
    teamsMap.get(key).add(e.constructor_id)
  }

  // ── Race results grouped by year ────────────────────────────────────────────
  const resultsByRace = new Map() // raceId → [result, ...]
  for (const r of raceResults) {
    if (!resultsByRace.has(r.raceId)) resultsByRace.set(r.raceId, [])
    resultsByRace.get(r.raceId).push(r)
  }

  const racesByYear = new Map() // year → [{id, ...race}]
  for (const [id, race] of races) {
    if (!racesByYear.has(race.year)) racesByYear.set(race.year, [])
    racesByYear.get(race.year).push({ id, ...race })
  }

  // ── Season driver standings grouped by year ─────────────────────────────────
  const standingsByYear = new Map()
  for (const s of seasonStandings) {
    if (!standingsByYear.has(s.year)) standingsByYear.set(s.year, [])
    standingsByYear.get(s.year).push(s)
  }

  // ── Career data grouped by driver ───────────────────────────────────────────
  const careerByDriver = new Map()
  for (const s of seasonStandings) {
    if (!careerByDriver.has(s.driver_id)) careerByDriver.set(s.driver_id, [])
    careerByDriver.get(s.driver_id).push(s)
  }

  // ── Create output directories ───────────────────────────────────────────────
  await mkdir(path.join(OUT_DIR, 'standings'), { recursive: true })
  await mkdir(path.join(OUT_DIR, 'races'), { recursive: true })

  // ── Write drivers.json ──────────────────────────────────────────────────────
  const driversOut = {}
  for (const [id, d] of drivers) {
    driversOut[id] = {
      id,
      abbreviation: d.abbreviation,
      permanentNumber: d.permanent_number,
      firstName: d.first_name,
      lastName: d.last_name,
      fullName: d.full_name,
      nationalityCountryId: d.nationality_country_id,
    }
  }
  await writeFile(path.join(OUT_DIR, 'drivers.json'), JSON.stringify(driversOut))
  console.log(`Wrote drivers.json (${drivers.size} drivers)`)

  // ── Write driver-id-map.json ────────────────────────────────────────────────
  // Maps Jolpica-style IDs (max_verstappen, hamilton) → f1db IDs (max-verstappen, lewis-hamilton)
  // Drivers with a permanent number (modern championship drivers) take priority over
  // historical drivers with the same surname, resolving conflicts like hamilton→lewis-hamilton.
  const tempIdMap = {} // key → {id, hasPermanentNumber}

  function setIdEntry(key, id, hasPermanentNumber) {
    if (!tempIdMap[key] || (hasPermanentNumber && !tempIdMap[key].hasPermanentNumber)) {
      tempIdMap[key] = { id, hasPermanentNumber }
    }
  }

  for (const [id, d] of drivers) {
    const hp = d.permanent_number != null
    // Normalize: lowercase, replace spaces/hyphens with underscores, strip trailing dots (e.g. "Jr.")
    const norm = s => (s ?? '').toLowerCase().replace(/[-\s]+/g, '_').replace(/[^a-z0-9_]/g, '')
    const first = norm(d.first_name)
    // Use only the first word of last name so "Sainz Jr." → "sainz" matching Jolpica's "carlos_sainz"
    const lastFull = norm(d.last_name)
    const lastBase = lastFull.split('_')[0]

    if (first && lastBase) setIdEntry(`${first}_${lastBase}`, id, hp)  // max_verstappen, carlos_sainz
    if (lastBase) setIdEntry(lastBase, id, hp)                          // hamilton, leclerc
  }

  const driverIdMap = Object.fromEntries(
    Object.entries(tempIdMap).map(([k, v]) => [k, v.id])
  )
  await writeFile(path.join(OUT_DIR, 'driver-id-map.json'), JSON.stringify(driverIdMap))
  console.log(`Wrote driver-id-map.json (${Object.keys(driverIdMap).length} entries)`)

  // ── Write per-year standings/{year}.json ────────────────────────────────────
  let standingsWritten = 0
  for (const [year, standings] of standingsByYear) {
    const out = standings
      .sort((a, b) => (a.position_display_order ?? a.position_number) - (b.position_display_order ?? b.position_number))
      .map(s => ({
        driverId: s.driver_id,
        position: s.position_number,
        positionText: s.position_text,
        points: Number(s.points),
        wins: winsMap.get(`${year}:${s.driver_id}`) ?? 0,
        championshipWon: s.championship_won === true,
      }))
    await writeFile(path.join(OUT_DIR, 'standings', `${year}.json`), JSON.stringify(out))
    standingsWritten++
  }
  console.log(`Wrote ${standingsWritten} standings/{year}.json files`)

  // ── Write per-year races/{year}.json ────────────────────────────────────────
  let racesWritten = 0
  for (const [year, yearRaces] of racesByYear) {
    const out = yearRaces
      .sort((a, b) => a.round - b.round)
      .map(race => ({
        id: race.id,
        round: race.round,
        grandPrixId: race.grandPrixId,
        date: race.date,
        results: (resultsByRace.get(race.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map(r => ({ driverId: r.driverId, position: r.position, points: r.points })),
      }))
    await writeFile(path.join(OUT_DIR, 'races', `${year}.json`), JSON.stringify(out))
    racesWritten++
  }
  console.log(`Wrote ${racesWritten} races/{year}.json files`)

  // ── Write career-all.json ───────────────────────────────────────────────────
  // Excludes current year (zero-points pre-season placeholder).
  // Format matches JolpicaCareerSeason so the hook can use it directly.
  const careerOut = {}
  for (const [driverId, seasons] of careerByDriver) {
    const filtered = seasons
      .filter(s => s.year < CURRENT_YEAR)
      .sort((a, b) => a.year - b.year)
      .map(s => {
        const wins = winsMap.get(`${s.year}:${driverId}`) ?? 0
        const maxRound = maxRoundByYear.get(s.year) ?? 0
        const teamKey = `${s.year}:${driverId}`
        const constructorIds = teamsMap.get(teamKey) ?? new Set()
        return {
          season: String(s.year),
          round: String(maxRound),
          position: String(s.position_number ?? s.position_text ?? ''),
          points: String(Number(s.points)),
          wins: String(wins),
          constructors: Array.from(constructorIds).map(cid => ({
            constructorId: cid,
            name: constructorNames.get(cid) ?? cid,
          })),
        }
      })
    if (filtered.length > 0) careerOut[driverId] = filtered
  }
  await writeFile(path.join(OUT_DIR, 'career-all.json'), JSON.stringify(careerOut))
  console.log(`Wrote career-all.json (${Object.keys(careerOut).length} drivers)`)

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
