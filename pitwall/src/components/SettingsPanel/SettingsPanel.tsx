import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  checkFastF1Server,
  getFastF1AuthStatus,
  signOutFastF1,
  startFastF1Auth,
} from '../../api/fastf1Bridge'
import { useSessionStore } from '../../store/sessionStore'
import { useAmbientStore } from '../../store/ambientStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useDriverStore } from '../../store/driverStore'
import { useLogStore } from '../../store/logStore'
import { DriverManagerPanel } from '../DriverManager/DriverManagerPanel'
import {
  createPitwallEnvelope,
  makePitwallFileName,
  parsePitwallFile,
  stringifyPitwallFile,
  type PitwallFileKind,
  type SettingsSnapshot,
  type SeasonSnapshot,
  type WorkspaceSnapshot,
} from '../../lib/pitwallFiles'
import { APP_VERSION_LABEL } from '../../lib/appMeta'
import { SmoothScrollContainer } from '../SmoothScrollContainer'

interface SettingsPanelProps {
  onClose: () => void
}

const EXPORT_KIND_OPTIONS: Array<{ kind: PitwallFileKind; label: string }> = [
  { kind: 'bundle', label: 'Full bundle' },
  { kind: 'settings', label: 'Settings only' },
  { kind: 'season', label: 'Season data only' },
  { kind: 'workspace', label: 'Workspace only' },
]

const STATUS_COLOR: Record<'ok' | 'error' | 'info', string> = {
  ok: 'var(--green)',
  error: 'var(--red)',
  info: 'var(--muted2)',
}

function applySettingsSnapshot(snapshot: SettingsSnapshot) {
  useSessionStore.setState({
    apiKey: snapshot.session.apiKey,
    mode: snapshot.session.mode,
    apiRequestsEnabled: snapshot.session.apiRequestsEnabled,
  })

  useAmbientStore.setState({
    leaderColorMode: snapshot.ambient.leaderColorMode,
    ambientLayerEnabled: snapshot.ambient.ambientLayerEnabled,
    ambientLayerIntensity: snapshot.ambient.ambientLayerIntensity,
    ambientLayerWaveEnabled: snapshot.ambient.ambientLayerWaveEnabled,
  })

  useDriverStore.setState({
    starred: snapshot.driver.starred,
    canvasFocus: snapshot.driver.canvasFocus,
    windowFocusSelector: snapshot.driver.windowFocusSelector,
  })
}

function applySeasonSnapshot(snapshot: SeasonSnapshot) {
  useDriverStore.setState({
    seasonYear: snapshot.seasonYear,
    drivers: snapshot.drivers,
    teamColors: snapshot.teamColors,
    teamColorOverrides: snapshot.teamColorOverrides ?? {},
    teamLogos: snapshot.teamLogos,
  })
}

function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  if (snapshot.tabs.length === 0) {
    throw new Error('Workspace file has no tabs.')
  }

  const hasActiveTab = snapshot.tabs.some((tab) => tab.id === snapshot.activeTabId)
  useWorkspaceStore.setState({
    tabs: snapshot.tabs,
    activeTabId: hasActiveTab ? snapshot.activeTabId : snapshot.tabs[0].id,
  })
}

async function readPitwallFileFromPicker(): Promise<{ fileName: string; contents: string } | null> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pitwall'

  return new Promise((resolve) => {
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const contents = await file.text()
        resolve({ fileName: file.name, contents })
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)',
      fontSize: 8,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--white)',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 0',
      borderBottom: '0.5px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="interactive-button"
      style={{
        padding: '5px 12px',
        borderRadius: 3,
        border: `0.5px solid ${disabled ? 'var(--border)' : variant === 'danger' ? 'var(--red)' : 'var(--border2)'}`,
        background: 'var(--bg4)',
        fontFamily: 'var(--mono)',
        fontSize: 8,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: variant === 'danger' ? 'var(--red)' : 'var(--white)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}

function ToggleSelector({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className="interactive-chip"
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      style={{
        width: 42,
        height: 18,
        padding: 2,
        appearance: 'none',
        WebkitAppearance: 'none',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 9,
        border: `0.5px solid ${checked ? 'var(--green)' : 'var(--border2)'}`,
        background: checked ? 'rgba(46,204,113,0.22)' : 'var(--bg4)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color var(--motion-base) ease, background-color var(--motion-base) ease, opacity var(--motion-fast) ease',
        flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: checked ? 'var(--bg2)' : 'var(--muted2)',
          transform: `translateX(${checked ? 24 : 0}px)`,
          transition: 'transform var(--motion-base) var(--motion-spring), background-color var(--motion-fast) ease',
          boxShadow: checked ? '0 0 0 1px rgba(46,204,113,0.35)' : 'none',
        }}
      />
    </button>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const EXIT_MS = 220
  const API_REVEAL_EXIT_MS = 180
  const {
    mode, apiKey, clearApiKey, setMode, apiRequestsEnabled, setApiRequestsEnabled,
    fastf1ServerAvailable, setFastF1ServerAvailable,
    f1tvAuthenticated, f1tvEmail, setF1TVAuth,
  } = useSessionStore()
  const {
    leaderColorMode,
    flagState,
    ambientLayerEnabled,
    ambientLayerIntensity,
    ambientLayerWaveEnabled,
    setLeaderColorMode,
    setAmbientLayerEnabled,
    setAmbientLayerIntensity,
    setAmbientLayerWaveEnabled,
  } = useAmbientStore()
  const { resetToDefault } = useWorkspaceStore()
  const starredCount = useDriverStore((s) => s.starred.length)
  const seasonYear = useDriverStore((s) => s.seasonYear)
  const windowFocusSelector = useDriverStore((s) => s.windowFocusSelector)
  const setWindowFocusSelector = useDriverStore((s) => s.setWindowFocusSelector)
  const teamColorOverrides = useDriverStore((s) => s.teamColorOverrides)
  const clearTeamColorForTeam = useDriverStore((s) => s.clearTeamColorForTeam)
  const logEntries = useLogStore((s) => s.entries)
  const clearLogs = useLogStore((s) => s.clear)

  const overrideCount = Object.keys(teamColorOverrides).length

  const [f1tvAuthPending, setF1tvAuthPending] = useState(false)
  const [f1tvAuthLoginUrl, setF1tvAuthLoginUrl] = useState<string | null>(null)
  const f1tvPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [apiKeyInputOpen, setApiKeyInputOpen] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [exportBaseName, setExportBaseName] = useState('pitwall')
  const [exportKind, setExportKind] = useState<PitwallFileKind>('bundle')
  const [ioBusy, setIoBusy] = useState(false)
  const [driverManagerOpen, setDriverManagerOpen] = useState(false)
  const [ioStatus, setIoStatus] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [apiKeyInputClosing, setApiKeyInputClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const apiKeyCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasApiKey = Boolean(apiKey)

  const { setApiKey } = useSessionStore()

  // Re-probe bridge + auth when settings panel mounts
  useEffect(() => {
    let cancelled = false
    async function probe() {
      const ok = await checkFastF1Server()
      if (cancelled) return
      setFastF1ServerAvailable(ok)
      if (ok) {
        try {
          const s = await getFastF1AuthStatus()
          if (!cancelled) setF1TVAuth(s.authenticated, s.email)
        } catch { /* ignore */ }
      }
    }
    probe()
    return () => { cancelled = true }
  }, [setFastF1ServerAvailable, setF1TVAuth])

  // Poll for F1TV auth completion
  useEffect(() => {
    if (!f1tvAuthPending) return
    f1tvPollRef.current = setInterval(async () => {
      try {
        const s = await getFastF1AuthStatus()
        if (s.authenticated) {
          setF1TVAuth(true, s.email)
          setF1tvAuthPending(false)
        }
      } catch { /* keep polling */ }
    }, 3_000)
    return () => { if (f1tvPollRef.current) clearInterval(f1tvPollRef.current) }
  }, [f1tvAuthPending, setF1TVAuth])

  async function handleF1TVSignIn() {
    try {
      const res = await startFastF1Auth()
      if (res.status === 'already_authenticated') {
        const s = await getFastF1AuthStatus()
        setF1TVAuth(s.authenticated, s.email)
        return
      }
      if (res.login_url) {
        setF1tvAuthLoginUrl(res.login_url)
        window.electronAPI?.openExternal(res.login_url)
        setF1tvAuthPending(true)
      }
    } catch { /* bridge not running */ }
  }

  async function handleF1TVSignOut() {
    await signOutFastF1().catch(() => {})
    setF1TVAuth(false, null)
    setF1tvAuthPending(false)
    setF1tvAuthLoginUrl(null)
  }

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
      if (apiKeyCloseTimerRef.current) clearTimeout(apiKeyCloseTimerRef.current)
    }
  }, [])

  function openApiKeyInput() {
    if (apiKeyCloseTimerRef.current) {
      clearTimeout(apiKeyCloseTimerRef.current)
      apiKeyCloseTimerRef.current = null
    }
    setApiKeyInputClosing(false)
    setApiKeyInputOpen(true)
  }

  function closeApiKeyInput(resetDraft = true) {
    if (!apiKeyInputOpen) return
    if (apiKeyInputClosing) return
    setApiKeyInputClosing(true)
    apiKeyCloseTimerRef.current = setTimeout(() => {
      setApiKeyInputOpen(false)
      setApiKeyInputClosing(false)
      if (resetDraft) setApiKeyDraft('')
    }, API_REVEAL_EXIT_MS)
  }

  function handleAddApiKey() {
    if (apiKeyDraft.trim()) {
      setApiKey(apiKeyDraft.trim())
      setApiKeyDraft('')
      closeApiKeyInput(false)
    }
  }

  function maskedKey(key: string) {
    return key.slice(0, 8) + '•••••'
  }

  function handleModeChange(nextMode: 'hub' | 'live') {
    if (nextMode === 'live') {
      if (!f1tvAuthenticated) return
      setMode('live')
      return
    }

    setMode('hub')
  }

  function exportDiagnostics() {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-')
    const blob = new Blob([JSON.stringify(logEntries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pitwall-log-${timestamp}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function buildSettingsSnapshot(): SettingsSnapshot {
    const session = useSessionStore.getState()
    const ambient = useAmbientStore.getState()
    const driver = useDriverStore.getState()
    return {
      session: {
        apiKey: session.apiKey,
        mode: session.mode,
        apiRequestsEnabled: session.apiRequestsEnabled,
      },
      ambient: {
        leaderColorMode: ambient.leaderColorMode,
        ambientLayerEnabled: ambient.ambientLayerEnabled,
        ambientLayerIntensity: ambient.ambientLayerIntensity,
        ambientLayerWaveEnabled: ambient.ambientLayerWaveEnabled,
      },
      driver: {
        starred: driver.starred,
        canvasFocus: driver.canvasFocus,
        windowFocusSelector: driver.windowFocusSelector,
      },
    }
  }

  function buildSeasonSnapshot(): SeasonSnapshot {
    const driver = useDriverStore.getState()
    return {
      seasonYear: driver.seasonYear,
      drivers: driver.drivers,
      teamColors: driver.teamColors,
      teamColorOverrides: driver.teamColorOverrides,
      teamLogos: driver.teamLogos,
    }
  }

  function buildWorkspaceSnapshot(): WorkspaceSnapshot {
    const workspace = useWorkspaceStore.getState()
    return {
      activeTabId: workspace.activeTabId,
      tabs: workspace.tabs,
    }
  }

  function buildEnvelopeByKind(kind: PitwallFileKind) {
    if (kind === 'settings') return createPitwallEnvelope('settings', buildSettingsSnapshot())
    if (kind === 'season') return createPitwallEnvelope('season', buildSeasonSnapshot())
    if (kind === 'workspace') return createPitwallEnvelope('workspace', buildWorkspaceSnapshot())
    return createPitwallEnvelope('bundle', {
      settings: buildSettingsSnapshot(),
      season: buildSeasonSnapshot(),
      workspace: buildWorkspaceSnapshot(),
    })
  }

  async function handleExportPitwall() {
    setIoBusy(true)
    setIoStatus(null)

    try {
      const envelope = buildEnvelopeByKind(exportKind)
      const defaultName = makePitwallFileName(exportBaseName, exportKind)
      const contents = stringifyPitwallFile(envelope)

      if (window.electronAPI?.savePitwallFile) {
        const result = await window.electronAPI.savePitwallFile({ defaultName, contents })
        if (result.canceled) {
          setIoStatus({ tone: 'info', text: 'Export canceled.' })
          return
        }
        setIoStatus({ tone: 'ok', text: `Exported ${exportKind} file to ${result.filePath ?? defaultName}.` })
        return
      }

      const blob = new Blob([contents], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = defaultName
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setIoStatus({ tone: 'ok', text: `Exported ${exportKind} file as ${defaultName}.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.'
      setIoStatus({ tone: 'error', text: `Export failed: ${message}` })
    } finally {
      setIoBusy(false)
    }
  }

  async function handleImportPitwall() {
    setIoBusy(true)
    setIoStatus(null)

    try {
      let fileName = 'imported.pitwall'
      let contents: string | null = null

      if (window.electronAPI?.openPitwallFile) {
        const result = await window.electronAPI.openPitwallFile()
        if (result.canceled) {
          setIoStatus({ tone: 'info', text: 'Import canceled.' })
          return
        }
        fileName = result.filePath ?? fileName
        contents = result.contents ?? null
      } else {
        const picked = await readPitwallFileFromPicker()
        if (!picked) {
          setIoStatus({ tone: 'info', text: 'Import canceled.' })
          return
        }
        fileName = picked.fileName
        contents = picked.contents
      }

      if (!contents) {
        throw new Error('No file contents were read.')
      }

      const envelope = parsePitwallFile(contents)
      if (envelope.kind === 'settings') applySettingsSnapshot(envelope.payload)
      if (envelope.kind === 'season') applySeasonSnapshot(envelope.payload)
      if (envelope.kind === 'workspace') applyWorkspaceSnapshot(envelope.payload)
      if (envelope.kind === 'bundle') {
        applySettingsSnapshot(envelope.payload.settings)
        applySeasonSnapshot(envelope.payload.season)
        applyWorkspaceSnapshot(envelope.payload.workspace)
      }

      setIoStatus({ tone: 'ok', text: `Imported ${envelope.kind} file from ${fileName}.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error.'
      setIoStatus({ tone: 'error', text: `Import failed: ${message}` })
    } finally {
      setIoBusy(false)
    }
  }

  return createPortal(
    <div
      onClick={handleRequestClose}
      className={isClosing ? 'glass-overlay glass-overlay-exit' : 'glass-overlay'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={isClosing ? 'modal-panel modal-panel-exit' : 'modal-panel'}
        style={{
          width: 520,
          maxHeight: 'calc(100vh - 120px)',
          background: 'var(--bg3)',
          border: '0.5px solid var(--border2)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--cond)',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.04em',
            flex: 1,
          }}>
            Settings
          </span>
          <button
            onClick={handleRequestClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--white)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <SmoothScrollContainer className="scroll-fade scroll-fade-top-only" style={{ flex: 1 }} innerStyle={{ padding: '0 16px' }}>

          {/* Account & Mode */}
          <Section>
            <SectionLabel>Account &amp; Mode</SectionLabel>

            {/* Mode selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--white)', letterSpacing: '0.06em' }}>
                Mode
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['hub', 'live'] as const).map((m) => {
                  const active = mode === m
                  const disabled = m === 'live' && !f1tvAuthenticated
                  return (
                    <button
                      key={m}
                      type="button"
                      className="interactive-chip"
                      onClick={() => handleModeChange(m)}
                      disabled={disabled}
                      title={disabled ? 'Sign in with F1TV to enable live mode' : undefined}
                      style={{
                        padding: '4px 14px',
                        borderRadius: 3,
                        border: `0.5px solid ${active ? 'var(--border3)' : 'var(--border)'}`,
                        background: active ? 'var(--bg4)' : 'transparent',
                        fontFamily: 'var(--mono)',
                        fontSize: 8,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: disabled ? 'var(--muted2)' : 'var(--white)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.55 : 1,
                      }}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
              {mode === 'live' && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em', color: 'var(--green)' }}>
                  Live mode active — using FastF1 session data.
                </span>
              )}
            </div>


            {/* FastF1: bridge status + F1TV auth */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: fastf1ServerAvailable ? '#00c864' : 'var(--muted2)',
                }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                  {fastf1ServerAvailable ? 'Python bridge running' : 'Python bridge not running'}
                </span>
              </div>

              <div>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 6,
                }}>
                  F1TV authentication
                </span>

                {f1tvAuthenticated ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--green)', letterSpacing: '0.06em' }}>
                      ✓ {f1tvEmail ? f1tvEmail : 'Authenticated'}
                    </span>
                    <button
                      onClick={handleF1TVSignOut}
                      style={{ background: 'none', border: 'none', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, letterSpacing: '0.06em', padding: 0 }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : f1tvAuthPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                      Waiting for browser sign-in…
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {f1tvAuthLoginUrl && (
                        <button
                          onClick={() => window.electronAPI?.openExternal(f1tvAuthLoginUrl)}
                          style={{ background: 'none', border: 'none', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--white)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, letterSpacing: '0.06em', padding: 0 }}
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => setF1tvAuthPending(false)}
                        style={{ background: 'none', border: 'none', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.06em', padding: 0 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <ActionButton onClick={handleF1TVSignIn} disabled={!fastf1ServerAvailable}>
                    Sign in with F1TV
                  </ActionButton>
                )}
              </div>
            </div>
          </Section>

          {/* Ambient Race Layer */}
          <Section>
            <SectionLabel>Ambient Race Layer</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Leader color mode toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}>
                <ToggleSelector
                  checked={leaderColorMode}
                  onChange={setLeaderColorMode}
                  ariaLabel="Leader color mode"
                />
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                  userSelect: 'none',
                }}>
                  Leader color mode
                </span>
              </label>

              {/* Current flag state */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                }}>
                  Flag state
                </span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--white)',
                }}>
                  {flagState}
                </span>
              </div>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                  userSelect: 'none',
                }}>
                  Ambient layer enabled
                </span>
                <ToggleSelector
                  checked={ambientLayerEnabled}
                  onChange={setAmbientLayerEnabled}
                  ariaLabel="Ambient layer enabled"
                />
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                  userSelect: 'none',
                }}>
                  Wave animation
                </span>
                <ToggleSelector
                  checked={ambientLayerWaveEnabled}
                  onChange={setAmbientLayerWaveEnabled}
                  disabled={!ambientLayerEnabled}
                  ariaLabel="Wave animation"
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--white)',
                    letterSpacing: '0.06em',
                  }}>
                    Ambient intensity
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: 'var(--white)',
                    letterSpacing: '0.08em',
                  }}>
                    {ambientLayerIntensity}%
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([25, 50, 75, 100] as const).map((pct) => {
                    const active = ambientLayerIntensity === pct
                    return (
                      <button
                        key={pct}
                        type="button"
                        className="interactive-chip"
                        onClick={() => setAmbientLayerIntensity(pct)}
                        disabled={!ambientLayerEnabled}
                        style={{
                          minWidth: 42,
                          padding: '3px 9px',
                          borderRadius: 3,
                          border: `0.5px solid ${active ? 'var(--border3)' : 'var(--border)'}`,
                          background: active ? 'var(--bg4)' : 'transparent',
                          fontFamily: 'var(--mono)',
                          fontSize: 8,
                          letterSpacing: '0.08em',
                          color: 'var(--white)',
                          cursor: ambientLayerEnabled ? 'pointer' : 'not-allowed',
                          opacity: ambientLayerEnabled ? 1 : 0.55,
                        }}
                      >
                        {pct}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </Section>

          {/* Data Layer */}
          <Section>
            <SectionLabel>Data Layer</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                  userSelect: 'none',
                }}>
                  Enable team radio polling
                </span>
                <ToggleSelector
                  checked={apiRequestsEnabled}
                  onChange={setApiRequestsEnabled}
                  ariaLabel="Enable team radio polling"
                />
              </label>

              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.06em',
                color: apiRequestsEnabled ? 'var(--green)' : 'var(--amber)',
              }}>
                {apiRequestsEnabled
                  ? 'Polling active. Team radio updates can request new data.'
                  : 'Polling paused. Cached team radio remains visible until re-enabled.'}
              </span>
            </div>
          </Section>

          {/* Drivers */}
          <Section>
            <SectionLabel>Drivers</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.08em',
                color: 'var(--white)',
              }}>
                {starredCount} starred drivers{seasonYear ? ` · ${seasonYear} season` : ''}
              </span>
              <ActionButton onClick={() => {
                if (window.electronAPI) {
                  void window.electronAPI.openNewWindow({ windowKind: 'driver-manager' })
                } else {
                  setDriverManagerOpen(true)
                }
              }}>
                Open driver manager
              </ActionButton>

              {overrideCount > 0 && (
                <ActionButton
                  variant="danger"
                  onClick={() => {
                    Object.keys(teamColorOverrides).forEach(clearTeamColorForTeam)
                  }}
                >
                  Reset {overrideCount} team color override{overrideCount !== 1 ? 's' : ''}
                </ActionButton>
              )}
            </div>
          </Section>

          {/* View */}
          <Section>
            <SectionLabel>View</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--white)', letterSpacing: '0.06em' }}>
                Window focus follows
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['FOCUS', 'P1', 'P2', 'P3', 'P4', 'P5', 'GAP+1', 'GAP-1'] as const).map((sel) => {
                  const active = windowFocusSelector === sel
                  return (
                    <button
                      key={sel}
                      type="button"
                      className="interactive-chip"
                      onClick={() => setWindowFocusSelector(sel)}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 3,
                        border: `0.5px solid ${active ? 'var(--border3)' : 'var(--border)'}`,
                        background: active ? 'var(--bg4)' : 'transparent',
                        fontFamily: 'var(--mono)',
                        fontSize: 8,
                        letterSpacing: '0.08em',
                        color: 'var(--white)',
                        cursor: 'pointer',
                      }}
                    >
                      {sel}
                    </button>
                  )
                })}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                {windowFocusSelector === 'FOCUS'
                  ? 'Follows the manually focused driver.'
                  : windowFocusSelector.startsWith('GAP')
                    ? `Follows the driver ${windowFocusSelector === 'GAP+1' ? 'one position ahead of' : 'one position behind'} the leader.`
                    : `Follows the driver in ${windowFocusSelector}.`}
              </span>
            </div>
          </Section>

          {/* Workspace */}
          <Section>
            <SectionLabel>Workspace</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ActionButton onClick={resetToDefault}>
                Reset workspace to default
              </ActionButton>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--white)',
                }}>
                  Import / Export (.pitwall)
                </span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={exportBaseName}
                    onChange={(e) => setExportBaseName(e.target.value)}
                    placeholder="File name"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'var(--bg4)',
                      border: '0.5px solid var(--border2)',
                      borderRadius: 3,
                      padding: '6px 10px',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--white)',
                      letterSpacing: '0.05em',
                      outline: 'none',
                    }}
                  />
                  <select
                    value={exportKind}
                    onChange={(e) => setExportKind(e.target.value as PitwallFileKind)}
                    style={{
                      width: 148,
                      background: 'var(--bg4)',
                      border: '0.5px solid var(--border2)',
                      borderRadius: 3,
                      padding: '6px 8px',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--white)',
                      letterSpacing: '0.04em',
                      outline: 'none',
                    }}
                  >
                    {EXPORT_KIND_OPTIONS.map((option) => (
                      <option key={option.kind} value={option.kind}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionButton onClick={handleExportPitwall} disabled={ioBusy}>
                    Export {exportKind}
                  </ActionButton>
                  <ActionButton onClick={handleImportPitwall} disabled={ioBusy}>
                    Import .pitwall
                  </ActionButton>
                </div>

                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.06em',
                  color: ioStatus ? STATUS_COLOR[ioStatus.tone] : 'var(--white)',
                  minHeight: 12,
                }}>
                  {ioStatus
                    ? ioStatus.text
                    : `Exported files are named like ${makePitwallFileName(exportBaseName || 'pitwall', exportKind)}.`}
                </span>
              </div>
            </div>
          </Section>

          {/* About */}
          <Section>
            <SectionLabel>About</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--white)',
                letterSpacing: '0.06em',
              }}>
                Pitwall {APP_VERSION_LABEL}
              </span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--white)',
                letterSpacing: '0.06em',
              }}>
                Data: FastF1 Bridge + OpenF1 Team Radio
              </span>
            </div>
          </Section>

          {/* Diagnostics */}
          <Section>
            <SectionLabel>Diagnostics</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--white)',
                letterSpacing: '0.08em',
              }}>
                {logEntries.length} log entries in memory (max 1000)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <ActionButton onClick={exportDiagnostics} disabled={logEntries.length === 0}>
                  Export logs
                </ActionButton>
                <ActionButton variant="danger" onClick={clearLogs} disabled={logEntries.length === 0}>
                  Clear logs
                </ActionButton>
              </div>
            </div>
          </Section>

        </SmoothScrollContainer>

        {driverManagerOpen && <DriverManagerPanel onClose={() => setDriverManagerOpen(false)} />}
      </div>
    </div>,
    document.body
  )
}
