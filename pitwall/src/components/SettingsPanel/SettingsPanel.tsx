import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSessionStore } from '../../store/sessionStore'
import { useAmbientStore } from '../../store/ambientStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

interface SettingsPanelProps {
  onClose: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)',
      fontSize: 8,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--muted2)',
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
      style={{
        padding: '5px 12px',
        borderRadius: 3,
        border: `0.5px solid ${disabled ? 'var(--border)' : variant === 'danger' ? 'var(--red)' : 'var(--border2)'}`,
        background: 'var(--bg4)',
        fontFamily: 'var(--mono)',
        fontSize: 8,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: disabled ? 'var(--muted2)' : variant === 'danger' ? 'var(--red)' : 'var(--muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { mode, apiKey, clearApiKey } = useSessionStore()
  const { leaderColorMode, flagState, setLeaderColorMode } = useAmbientStore()
  // TODO: resetToDefault does not yet exist on workspaceStore — disabled until implemented
  const workspaceResetExists = 'resetToDefault' in useWorkspaceStore.getState()

  const [apiKeyInputOpen, setApiKeyInputOpen] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')

  const { setApiKey } = useSessionStore()

  function handleAddApiKey() {
    if (apiKeyDraft.trim()) {
      setApiKey(apiKeyDraft.trim())
      setApiKeyDraft('')
      setApiKeyInputOpen(false)
    }
  }

  function maskedKey(key: string) {
    return key.slice(0, 8) + '•••••'
  }

  return createPortal(
    <div
      onClick={onClose}
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
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
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
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>

          {/* Account & Mode */}
          <Section>
            <SectionLabel>Account &amp; Mode</SectionLabel>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted)',
                letterSpacing: '0.06em',
              }}>
                Current mode
              </span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: mode === 'live' ? 'var(--green)' : 'var(--amber)',
                border: `0.5px solid ${mode === 'live' ? 'var(--green)' : 'var(--amber)'}`,
                borderRadius: 2,
                padding: '1px 6px',
              }}>
                {mode === 'live' ? 'LIVE' : 'HISTORICAL'}
              </span>
            </div>

            {mode === 'live' && apiKey ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--muted2)',
                    letterSpacing: '0.06em',
                  }}>
                    API key
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--muted)',
                    letterSpacing: '0.08em',
                  }}>
                    {maskedKey(apiKey)}
                  </span>
                </div>
                <ActionButton variant="danger" onClick={clearApiKey}>
                  Switch to historical
                </ActionButton>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--muted2)',
                  letterSpacing: '0.06em',
                }}>
                  Historical mode — no live data
                </span>

                {!apiKeyInputOpen ? (
                  <ActionButton onClick={() => setApiKeyInputOpen(true)}>
                    Add API key for live mode
                  </ActionButton>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddApiKey()
                        if (e.key === 'Escape') setApiKeyInputOpen(false)
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
                      <ActionButton onClick={() => { setApiKeyInputOpen(false); setApiKeyDraft('') }}>
                        Cancel
                      </ActionButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Ambient Layer */}
          <Section>
            <SectionLabel>Ambient Layer</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Leader color mode toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}>
                <div
                  onClick={() => setLeaderColorMode(!leaderColorMode)}
                  role="checkbox"
                  aria-checked={leaderColorMode}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setLeaderColorMode(!leaderColorMode) }}
                  style={{
                    width: 28,
                    height: 14,
                    borderRadius: 7,
                    background: leaderColorMode ? 'var(--green)' : 'var(--bg4)',
                    border: `0.5px solid ${leaderColorMode ? 'var(--green)' : 'var(--border2)'}`,
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: leaderColorMode ? 14 : 2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: leaderColorMode ? 'var(--bg)' : 'var(--muted2)',
                    transition: 'left 0.15s',
                  }} />
                </div>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--muted)',
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
                  color: 'var(--muted2)',
                  letterSpacing: '0.06em',
                }}>
                  Flag state
                </span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}>
                  {flagState}
                </span>
              </div>
            </div>
          </Section>

          {/* Workspace */}
          <Section>
            <SectionLabel>Workspace</SectionLabel>
            {/* TODO: resetToDefault not yet implemented on workspaceStore */}
            <ActionButton
              disabled={!workspaceResetExists}
              onClick={workspaceResetExists ? () => (useWorkspaceStore.getState() as any).resetToDefault() : undefined}
            >
              Reset workspace to default
            </ActionButton>
            {!workspaceResetExists && (
              <p style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--muted2)',
                letterSpacing: '0.06em',
                marginTop: 8,
              }}>
                Reset not available yet
              </p>
            )}
          </Section>

          {/* About */}
          <Section>
            <SectionLabel>About</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted)',
                letterSpacing: '0.06em',
              }}>
                Pitwall v0.1.0-alpha
              </span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted2)',
                letterSpacing: '0.06em',
              }}>
                Data: OpenF1 API
              </span>
            </div>
          </Section>

        </div>
      </div>
    </div>,
    document.body
  )
}
