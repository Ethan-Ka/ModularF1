/**
 * Persistent F1 data store backed by SQLite.
 * Lives in app.getPath('userData')/f1-data.sqlite — survives cache clears and app updates.
 *
 * All public functions are no-ops (return safe defaults) when better-sqlite3 is unavailable,
 * so the app degrades gracefully in environments where the native module isn't installed.
 */

const path = require('path')
const { app } = require('electron')

let db = null
let stmts = null

const VALID_TABLES = new Set(['drivers', 'laps', 'intervals', 'stints', 'weather', 'race_control', 'positions'])
const TABLES_WITHOUT_DRIVER = new Set(['weather', 'race_control'])

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  let Database
  try {
    Database = require('better-sqlite3')
  } catch {
    console.warn('[F1Store] better-sqlite3 not available — persistent storage disabled.')
    return
  }

  const dbPath = path.join(app.getPath('userData'), 'f1-data.sqlite')
  console.log(`[F1Store] Opening database at ${dbPath}`)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  createSchema()
  prepareStatements()
  console.log('[F1Store] Ready.')
}

// ---------------------------------------------------------------------------
// Schema — each table created with a separate prepare().run() to avoid exec()
// ---------------------------------------------------------------------------

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`,

  // Tracks whether a session's data is final (is_complete=1 → never re-fetch).
  // driver_number=-1 means the full-session collection (all drivers).
  `CREATE TABLE IF NOT EXISTS session_collections (
    table_name    TEXT    NOT NULL,
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL DEFAULT -1,
    is_complete   INTEGER NOT NULL DEFAULT 0,
    fetched_at    INTEGER NOT NULL,
    PRIMARY KEY (table_name, session_key, driver_number)
  )`,

  `CREATE TABLE IF NOT EXISTS drivers (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    data          TEXT    NOT NULL,
    PRIMARY KEY (session_key, driver_number)
  )`,

  `CREATE TABLE IF NOT EXISTS laps (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    lap_number    INTEGER NOT NULL,
    data          TEXT    NOT NULL,
    PRIMARY KEY (session_key, driver_number, lap_number)
  )`,

  `CREATE TABLE IF NOT EXISTS intervals (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    date          TEXT    NOT NULL,
    data          TEXT    NOT NULL,
    PRIMARY KEY (session_key, driver_number, date)
  )`,

  `CREATE TABLE IF NOT EXISTS stints (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    stint_number  INTEGER NOT NULL,
    data          TEXT    NOT NULL,
    PRIMARY KEY (session_key, driver_number, stint_number)
  )`,

  // Stores deduplicated latest position per driver (one row per driver per session)
  `CREATE TABLE IF NOT EXISTS positions (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    data          TEXT    NOT NULL,
    PRIMARY KEY (session_key, driver_number)
  )`,

  `CREATE TABLE IF NOT EXISTS weather (
    session_key INTEGER NOT NULL,
    date        TEXT    NOT NULL,
    data        TEXT    NOT NULL,
    PRIMARY KEY (session_key, date)
  )`,

  `CREATE TABLE IF NOT EXISTS race_control (
    session_key INTEGER NOT NULL,
    date        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    data        TEXT    NOT NULL,
    PRIMARY KEY (session_key, date, category)
  )`,
]

function createSchema() {
  for (const sql of SCHEMA_STATEMENTS) {
    db.prepare(sql).run()
  }
  const versionRow = db.prepare('SELECT version FROM schema_version').get()
  if (!versionRow) db.prepare('INSERT INTO schema_version VALUES (1)').run()
}

// ---------------------------------------------------------------------------
// Prepared statements (cached for performance)
// ---------------------------------------------------------------------------

function prepareStatements() {
  stmts = {
    drivers_upsert: db.prepare(
      `INSERT INTO drivers (session_key, driver_number, data) VALUES (?, ?, ?)
       ON CONFLICT (session_key, driver_number) DO UPDATE SET data = excluded.data`
    ),
    laps_upsert: db.prepare(
      `INSERT INTO laps (session_key, driver_number, lap_number, data) VALUES (?, ?, ?, ?)
       ON CONFLICT DO UPDATE SET data = excluded.data`
    ),
    intervals_upsert: db.prepare(
      `INSERT INTO intervals (session_key, driver_number, date, data) VALUES (?, ?, ?, ?)
       ON CONFLICT DO UPDATE SET data = excluded.data`
    ),
    stints_upsert: db.prepare(
      `INSERT INTO stints (session_key, driver_number, stint_number, data) VALUES (?, ?, ?, ?)
       ON CONFLICT DO UPDATE SET data = excluded.data`
    ),
    positions_upsert: db.prepare(
      `INSERT INTO positions (session_key, driver_number, data) VALUES (?, ?, ?)
       ON CONFLICT (session_key, driver_number) DO UPDATE SET data = excluded.data`
    ),
    weather_upsert: db.prepare(
      `INSERT INTO weather (session_key, date, data) VALUES (?, ?, ?)
       ON CONFLICT DO UPDATE SET data = excluded.data`
    ),
    race_control_upsert: db.prepare(
      `INSERT INTO race_control (session_key, date, category, data) VALUES (?, ?, ?, ?)
       ON CONFLICT DO UPDATE SET data = excluded.data`
    ),
    collection_upsert: db.prepare(
      `INSERT INTO session_collections (table_name, session_key, driver_number, is_complete, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (table_name, session_key, driver_number)
       DO UPDATE SET is_complete = excluded.is_complete, fetched_at = excluded.fetched_at`
    ),
    collection_read: db.prepare(
      `SELECT is_complete FROM session_collections
       WHERE table_name = ? AND session_key = ? AND driver_number = ?`
    ),
    collection_read_full: db.prepare(
      `SELECT is_complete FROM session_collections
       WHERE table_name = ? AND session_key = ? AND driver_number = -1`
    ),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateTable(name) {
  if (!VALID_TABLES.has(name)) throw new Error(`[F1Store] Unknown table: ${name}`)
}

// ---------------------------------------------------------------------------
// Row inserter per table
// ---------------------------------------------------------------------------

function insertRow(tableName, row) {
  const d = JSON.stringify(row)
  switch (tableName) {
    case 'drivers':
      stmts.drivers_upsert.run(row.session_key, row.driver_number, d)
      break
    case 'laps':
      stmts.laps_upsert.run(row.session_key, row.driver_number, row.lap_number, d)
      break
    case 'intervals':
      stmts.intervals_upsert.run(row.session_key, row.driver_number, row.date, d)
      break
    case 'stints':
      stmts.stints_upsert.run(row.session_key, row.driver_number, row.stint_number, d)
      break
    case 'positions':
      stmts.positions_upsert.run(row.session_key, row.driver_number, d)
      break
    case 'weather':
      stmts.weather_upsert.run(row.session_key, row.date, d)
      break
    case 'race_control':
      stmts.race_control_upsert.run(row.session_key, row.date, row.category, d)
      break
    default:
      throw new Error(`[F1Store] No inserter for table: ${tableName}`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read all stored rows for a session (and optionally a specific driver).
 * Returns an empty array when the store is unavailable or no data exists.
 */
function readCollection(tableName, sessionKey, driverNumber) {
  if (!db) return []
  validateTable(tableName)

  let rows
  if (driverNumber != null && !TABLES_WITHOUT_DRIVER.has(tableName)) {
    rows = db.prepare(`SELECT data FROM ${tableName} WHERE session_key = ? AND driver_number = ?`)
              .all(sessionKey, driverNumber)
  } else {
    rows = db.prepare(`SELECT data FROM ${tableName} WHERE session_key = ?`)
              .all(sessionKey)
  }

  return rows.map((r) => JSON.parse(r.data))
}

/**
 * Upsert rows into the persistent store and record the session_collections state.
 * Pass isComplete=true when the session is historical (data will never change again).
 * driverNumber: omit (or -1) for a full-session write.
 */
function writeCollection(tableName, sessionKey, rows, isComplete, driverNumber) {
  if (!db || !stmts) return
  validateTable(tableName)
  if (!Array.isArray(rows) || rows.length === 0) return

  const drNum = driverNumber ?? -1
  const now = Date.now()

  db.transaction(() => {
    for (const row of rows) {
      insertRow(tableName, row)
    }
    stmts.collection_upsert.run(tableName, sessionKey, drNum, isComplete ? 1 : 0, now)
  })()
}

/**
 * Returns true if the stored collection is marked complete (immutable).
 * A full-session (-1) complete record also satisfies a per-driver check.
 */
function isCollectionComplete(tableName, sessionKey, driverNumber) {
  if (!db || !stmts) return false
  validateTable(tableName)

  const drNum = driverNumber ?? -1

  if (drNum !== -1) {
    const fullRow = stmts.collection_read_full.get(tableName, sessionKey)
    if (fullRow?.is_complete === 1) return true
  }

  const row = stmts.collection_read.get(tableName, sessionKey, drNum)
  return row?.is_complete === 1
}

/** Whether the store has been successfully opened. */
function isAvailable() {
  return db !== null
}

module.exports = { init, readCollection, writeCollection, isCollectionComplete, isAvailable }
