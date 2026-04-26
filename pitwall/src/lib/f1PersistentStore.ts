/**
 * Renderer-side client for the Electron persistent F1 data store.
 *
 * All functions degrade gracefully to no-ops / empty returns when running
 * outside Electron (e.g. plain Vite dev server), so hooks stay unconditionally
 * callable regardless of environment.
 */

interface F1StoreAPI {
  read(table: string, sessionKey: number, driverNumber?: number): Promise<unknown[]>
  write(table: string, sessionKey: number, rows: unknown[], isComplete: boolean, driverNumber?: number): Promise<void>
  isComplete(table: string, sessionKey: number, driverNumber?: number): Promise<boolean>
}

function getStore(): F1StoreAPI | null {
  return (window as any).electronAPI?.f1store ?? null
}

/**
 * Read all stored rows for the given table + session.
 * Pass driverNumber to retrieve only that driver's rows.
 */
export async function readSessionData<T>(
  table: string,
  sessionKey: number,
  driverNumber?: number,
): Promise<T[]> {
  const store = getStore()
  if (!store) return []
  try {
    return (await store.read(table, sessionKey, driverNumber)) as T[]
  } catch {
    return []
  }
}

/**
 * Upsert rows into the persistent store.
 * Set isHistorical=true when the session is over so it is never re-fetched.
 * Fire-and-forget: callers should use `void writeSessionData(...)` to avoid
 * blocking the render path on IPC round-trip latency.
 */
export async function writeSessionData<T>(
  table: string,
  sessionKey: number,
  rows: T[],
  isHistorical: boolean,
  driverNumber?: number,
): Promise<void> {
  const store = getStore()
  if (!store || rows.length === 0) return
  try {
    await store.write(table, sessionKey, rows as unknown[], isHistorical, driverNumber)
  } catch {
    // Store writes must never crash the render path
  }
}

/**
 * Returns true if the stored collection is marked complete (immutable).
 * A full-session completion also covers per-driver queries.
 */
export async function isSessionDataComplete(
  table: string,
  sessionKey: number,
  driverNumber?: number,
): Promise<boolean> {
  const store = getStore()
  if (!store) return false
  try {
    return await store.isComplete(table, sessionKey, driverNumber)
  } catch {
    return false
  }
}
