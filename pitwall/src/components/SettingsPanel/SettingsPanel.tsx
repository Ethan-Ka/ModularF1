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
    dataSource, setDataSource,
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
  const logEntries = useLogStore((s) => s.entries)
  const clearLogs = useLogStore((s) => s.clear)

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

  function handleModeChange(nextMode: 'historical' | 'live') {
    if (nextMode === 'live') {
      if (!hasApiKey) return
      setMode('live')
      return
    }

    setMode('historical')
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
        <div className="scroll-fade scroll-fade-top-only" style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>

          {/* Account & Mode */}
          <Section>
            <SectionLabel>Account &amp; Mode</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--white)',
                letterSpacing: '0.06em',
              }}>
                Data mode
              </span>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: 4,
                borderRadius: 4,
                border: '0.5px solid var(--border2)',
                background: 'var(--bg4)',
                width: 'fit-content',
              }}>
                {([
                  { value: 'historical', label: 'Historical', disabled: false },
                  { value: 'live', label: 'Live', disabled: !hasApiKey },
                ] as const).map((option) => {
                  const active = mode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="interactive-chip"
                      disabled={option.disabled}
                      onClick={() => handleModeChange(option.value)}
                      style={{
                        minWidth: 96,
                        padding: '4px 10px',
                        borderRadius: 3,
                        border: `0.5px solid ${active ? (option.value === 'live' ? 'var(--green)' : 'var(--amber)') : 'var(--border2)'}`,
                        background: active
                          ? option.value === 'live'
                            ? 'rgba(46,204,113,0.18)'
                            : 'rgba(230,126,34,0.18)'
                          : 'var(--bg3)',
                        color: option.disabled ? 'var(--muted2)' : active ? 'var(--white)' : 'var(--muted)',
                        fontFamily: 'var(--mono)',
                        fontSize: 8,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        cursor: option.disabled ? 'not-allowed' : 'pointer',
                        opacity: option.disabled ? 0.5 : 1,
                        transition: 'all var(--motion-fast) ease',
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {!hasApiKey && (
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.08em',
                  color: 'var(--muted2)',
                  textTransform: 'uppercase',
                }}>
                  Live mode requires an API key
                </span>
              )}
            </div>

            {hasApiKey ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--white)',
                    letterSpacing: '0.06em',
                  }}>
                    API key
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--white)',
                    letterSpacing: '0.08em',
                  }}>
                    {maskedKey(apiKey!)}
                  </span>
                </div>
                <ActionButton variant="danger" onClick={clearApiKey}>
                  Remove API key
                </ActionButton>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--white)',
                  letterSpacing: '0.06em',
                }}>
                  Historical mode — no live data
                </span>

                {!apiKeyInputOpen ? (
                  <ActionButton onClick={openApiKeyInput}>
                    Add API key for live mode
                  </ActionButton>
                ) : (
                  <div
                    className={apiKeyInputClosing ? 'animated-slide-down-exit' : 'reveal-grow'}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <input
                      type="text"
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddApiKey()
                        if (e.key === 'Escape') closeApiKeyInput()
                      }}
                      placeholder="Enter OpenF1 API key..."
                      autoFocus
                      style={{
                        background: 'var(--bg4)',
                        border: '0.5px solid var(--border2)',
                        borderRadius: 3,
                        padding: '6px 10px',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        color: 'var(--white)',
                        outline: 'none',
                        letterSpacing: '0.06em',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ActionButton onClick={handleAddApiKey}>Save key</ActionButton>
                      <ActionButton onClick={() => closeApiKeyInput()}>
                        Cancel
                      </ActionButton>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                  Enable OpenF1 API polling
                </span>
                <ToggleSelector
                  checked={apiRequestsEnabled}
                  onChange={setApiRequestsEnabled}
                  ariaLabel="Enable OpenF1 API polling"
                />
              </label>

              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.06em',
                color: apiRequestsEnabled ? 'var(--green)' : 'var(--amber)',
              }}>
                {apiRequestsEnabled
                  ? 'Polling active. Live and historical fetch hooks can request new data.'
                  : 'Polling paused. Existing cached data remains visible until re-enabled.'}
              </span>
            </div>
          </Section>

          {/* FastF1 */}
          <Section>
            <SectionLabel>FastF1</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Data source selector */}
              <div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--white)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Active data source
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {(['openf1', 'fastf1'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setDataSource(s)}
                      style={{
                        background: dataSource === s ? 'var(--bg4)' : 'transparent',
                        border: `0.5px solid ${dataSource === s ? 'var(--red)' : 'var(--border)'}`,
                        borderRadius: 3,
                        padding: '7px 0',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: dataSource === s ? 'var(--white)' : 'var(--muted)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {s === 'openf1' ? 'OpenF1' : 'FastF1'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bridge status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: fastf1ServerAvailable ? '#00c864' : 'var(--muted2)',
                }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                  {fastf1ServerAvailable ? 'Python bridge running' : 'Python bridge not running'}
                </span>
              </div>

              {/* F1TV auth */}
              <div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--white)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
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
              <ActionButton onClick={() => setDriverManagerOpen(true)}>
                Open driver manager
              </ActionButton>
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
                Data: OpenF1 API
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

        </div>

        {driverManagerOpen && <DriverManagerPanel onClose={() => setDriverManagerOpen(false)} />}
      </div>
    </div>,
    document.body
  )
}
