import { useEffect, useRef, useState } from 'react'
import {
  checkFastF1Server,
  getFastF1AuthStatus,
  signOutFastF1,
  startFastF1Auth,
} from '../api/fastf1Bridge'
import { validateApiKey } from '../api/openf1'
import { useSessionStore, type DataSource } from '../store/sessionStore'

export function ApiKeyOnboarding() {
  const { setApiKey, setMode, setDataSource, setF1TVAuth, setFastF1ServerAvailable } =
    useSessionStore()

  // Which source tab is previewed (not yet committed to store)
  const [source, setSource] = useState<DataSource>('openf1')

  // ── OpenF1 state ──────────────────────────────────────────────────────────
  const [key, setKey] = useState('')
  const [keyStatus, setKeyStatus] = useState<
    'idle' | 'loading' | 'error_invalid' | 'error_forbidden' | 'error_rate' | 'error_network'
  >('idle')

  // ── FastF1 state ──────────────────────────────────────────────────────────
  const [bridgeReady, setBridgeReady] = useState<boolean | null>(null)
  const [f1tvStatus, setF1tvStatus] = useState<'unknown' | 'authenticated' | 'unauthenticated'>(
    'unknown'
  )
  const [f1tvEmail, setF1tvEmail] = useState<string | null>(null)
  const [authPending, setAuthPending] = useState(false)
  const [authLoginUrl, setAuthLoginUrl] = useState<string | null>(null)
  const [authInstructions, setAuthInstructions] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check bridge + F1TV status when FastF1 tab is opened
  useEffect(() => {
    if (source !== 'fastf1') return
    let cancelled = false

    async function probe() {
      const ok = await checkFastF1Server()
      if (cancelled) return
      setBridgeReady(ok)
      setFastF1ServerAvailable(ok)
      if (ok) {
        try {
          const s = await getFastF1AuthStatus()
          if (!cancelled) {
            setF1tvStatus(s.authenticated ? 'authenticated' : 'unauthenticated')
            setF1tvEmail(s.email)
            setF1TVAuth(s.authenticated, s.email)
          }
        } catch {
          if (!cancelled) setF1tvStatus('unauthenticated')
        }
      }
    }

    probe()
    return () => { cancelled = true }
  }, [source, setFastF1ServerAvailable, setF1TVAuth])

  // Poll for F1TV auth completion after the browser flow is opened
  useEffect(() => {
    if (!authPending) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await getFastF1AuthStatus()
        if (s.authenticated) {
          setF1tvStatus('authenticated')
          setF1tvEmail(s.email)
          setF1TVAuth(true, s.email)
          setAuthPending(false)
        }
      } catch {
        // bridge may have restarted; keep polling
      }
    }, 3_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [authPending, setF1TVAuth])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleOpenF1Validate() {
    if (!key.trim()) return
    setKeyStatus('loading')
    const result = await validateApiKey(key.trim())
    if (result === 'valid') {
      setDataSource('openf1')
      setApiKey(key.trim())
    } else if (result === 'invalid') setKeyStatus('error_invalid')
    else if (result === 'forbidden') setKeyStatus('error_forbidden')
    else if (result === 'rate_limited') setKeyStatus('error_rate')
    else setKeyStatus('error_network')
  }

  function handleOpenF1Historical() {
    setDataSource('openf1')
    setMode('historical')
  }

  async function handleF1TVSignIn() {
    try {
      const res = await startFastF1Auth()
      if (res.status === 'already_authenticated') {
        const s = await getFastF1AuthStatus()
        setF1tvStatus('authenticated')
        setF1tvEmail(s.email)
        setF1TVAuth(true, s.email)
        return
      }
      if (res.login_url) {
        setAuthLoginUrl(res.login_url)
        setAuthInstructions(res.instructions ?? null)
        window.electronAPI?.openExternal(res.login_url)
        setAuthPending(true)
      }
    } catch {
      // bridge not running — UI already shows the bridge warning
    }
  }

  async function handleF1TVSignOut() {
    await signOutFastF1().catch(() => {})
    setF1tvStatus('unauthenticated')
    setF1tvEmail(null)
    setF1TVAuth(false, null)
    setAuthPending(false)
  }

  function handleFastF1Historical() {
    setDataSource('fastf1')
    setMode('historical')
  }

  function handleFastF1Live() {
    setDataSource('fastf1')
    setMode('live')
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const monoSm: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted2)',
  }

  const card: React.CSSProperties = {
    background: 'var(--bg3)',
    border: '0.5px solid var(--border)',
    borderRadius: 4,
    padding: '16px 18px',
  }

  const primaryBtn = (active: boolean): React.CSSProperties => ({
    width: '100%',
    background: active ? 'var(--red)' : 'rgba(232,19,43,0.2)',
    border: 'none',
    borderRadius: 3,
    padding: '11px',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    cursor: active ? 'pointer' : 'not-allowed',
    marginBottom: 8,
    transition: 'background 0.15s',
  })

  const ghostBtn: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: '0.5px solid var(--border)',
    borderRadius: 3,
    padding: '10px',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    cursor: 'pointer',
  }

  const errorBox = (color: string, bg: string, border: string): React.CSSProperties => ({
    background: bg,
    border: `0.5px solid ${border}`,
    borderRadius: 3,
    padding: '8px 12px',
    fontSize: 11,
    color,
    marginBottom: 10,
    fontFamily: 'var(--mono)',
  })

  return (
    <div
      className="animated-fade"
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="animated-surface" style={{ width: 480, padding: '0 24px' }}>
        {/* Logo */}
        <div
          style={{
            fontFamily: 'var(--cond)',
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          PIT<span style={{ color: 'var(--red)' }}>W</span>ALL
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 32,
          }}
        >
          F1 race intelligence platform
        </div>

        {/* Source selector */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...monoSm, marginBottom: 8 }}>Data source</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['openf1', 'fastf1'] as DataSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className="interactive-button"
                style={{
                  background: source === s ? 'var(--bg4)' : 'transparent',
                  border: `0.5px solid ${source === s ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 3,
                  padding: '9px 0',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: source === s ? 'var(--white)' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {s === 'openf1' ? 'OpenF1' : 'FastF1'}
              </button>
            ))}
          </div>
        </div>

        {/* ── OpenF1 panel ─────────────────────────────────────────────── */}
        {source === 'openf1' && (
          <>
            <div
              style={{
                fontFamily: 'var(--cond)',
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              OpenF1 API Tiers
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="interactive-card" style={card}>
                <div style={{ ...monoSm, marginBottom: 8 }}>Historical</div>
                <div
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Free
                </div>
                <div style={{ fontSize: 11, color: 'rgba(242,240,235,0.55)', lineHeight: 1.6, fontWeight: 300 }}>
                  2023–present · all widgets · no live updates
                </div>
              </div>
              <div
                className="interactive-card"
                style={{ ...card, border: '0.5px solid var(--border2)', borderLeft: '2px solid var(--red)' }}
              >
                <div style={{ ...monoSm, marginBottom: 8 }}>Live</div>
                <div
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  €10<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>/mo</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(242,240,235,0.55)', lineHeight: 1.6, fontWeight: 300 }}>
                  ~3s real-time · team radio · all 18 endpoints
                </div>
              </div>
            </div>

            <div
              style={{
                marginBottom: 18,
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--muted)',
                letterSpacing: '0.04em',
              }}
            >
              Need live data?{' '}
              <a
                href="https://openf1.org/subscribe"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--white)', textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                Buy an OpenF1 API key
              </a>
              .
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...monoSm, marginBottom: 8 }}>OpenF1 API key (optional)</div>
              <input
                type="text"
                value={key}
                onChange={(e) => { setKey(e.target.value); setKeyStatus('idle') }}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenF1Validate()}
                placeholder="Paste your OpenF1 subscriber key…"
                style={{
                  width: '100%',
                  background: 'var(--bg4)',
                  border: `0.5px solid ${keyStatus.startsWith('error') ? 'var(--red)' : 'var(--border2)'}`,
                  borderRadius: 3,
                  padding: '10px 14px',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--white)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {keyStatus === 'error_invalid' && (
              <div style={errorBox('var(--red)', 'var(--red2)', 'rgba(232,19,43,0.28)')}>
                Invalid API key — HTTP 401. Check openf1.org/account.
              </div>
            )}
            {keyStatus === 'error_forbidden' && (
              <div style={errorBox('var(--red)', 'var(--red2)', 'rgba(232,19,43,0.28)')}>
                Subscription required — HTTP 403. Visit openf1.org/subscribe.
              </div>
            )}
            {keyStatus === 'error_rate' && (
              <div style={errorBox('var(--amber)', 'rgba(224,144,0,0.1)', 'rgba(224,144,0,0.3)')}>
                Rate limit hit — wait 60 seconds and try again.
              </div>
            )}
            {keyStatus === 'error_network' && (
              <div style={errorBox('var(--muted)', 'rgba(74,74,79,0.2)', 'var(--border2)')}>
                Network error — check your connection, then try again.
              </div>
            )}

            <button
              onClick={handleOpenF1Validate}
              disabled={!key.trim() || keyStatus === 'loading'}
              className="interactive-button"
              style={primaryBtn(!!key.trim() && keyStatus !== 'loading')}
            >
              {keyStatus === 'loading' ? 'Validating…' : 'Enable live mode'}
            </button>

            <button onClick={handleOpenF1Historical} className="interactive-button" style={ghostBtn}>
              Continue with historical data
            </button>
          </>
        )}

        {/* ── FastF1 panel ─────────────────────────────────────────────── */}
        {source === 'fastf1' && (
          <>
            <div
              style={{
                fontFamily: 'var(--cond)',
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              FastF1 Data Source
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="interactive-card" style={card}>
                <div style={{ ...monoSm, marginBottom: 8 }}>Historical</div>
                <div
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Free
                </div>
                <div style={{ fontSize: 11, color: 'rgba(242,240,235,0.55)', lineHeight: 1.6, fontWeight: 300 }}>
                  2018–present · richer telemetry · lap-aligned car data
                </div>
              </div>
              <div
                className="interactive-card"
                style={{ ...card, border: '0.5px solid var(--border2)', borderLeft: '2px solid var(--red)' }}
              >
                <div style={{ ...monoSm, marginBottom: 8 }}>Live</div>
                <div
                  style={{
                    fontFamily: 'var(--cond)',
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 6,
                    lineHeight: 1.2,
                  }}
                >
                  F1TV Sub
                </div>
                <div style={{ fontSize: 11, color: 'rgba(242,240,235,0.55)', lineHeight: 1.6, fontWeight: 300 }}>
                  Direct SignalR feed · no rate limits · lower latency
                </div>
              </div>
            </div>

            {/* Bridge status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                padding: '8px 12px',
                background: 'var(--bg3)',
                border: `0.5px solid ${bridgeReady === false ? 'rgba(232,19,43,0.3)' : bridgeReady === true ? 'rgba(0,200,100,0.25)' : 'var(--border)'}`,
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background:
                    bridgeReady === null
                      ? 'var(--muted2)'
                      : bridgeReady
                      ? '#00c864'
                      : 'var(--red)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                {bridgeReady === null
                  ? 'Checking Python bridge…'
                  : bridgeReady
                  ? 'Python bridge running'
                  : 'Python bridge not found — run npm run fastf1:install then restart'}
              </span>
            </div>

            {/* F1TV auth section */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...monoSm, marginBottom: 8 }}>F1TV authentication (optional, for live timing)</div>

              {f1tvStatus === 'authenticated' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(0,200,100,0.08)',
                    border: '0.5px solid rgba(0,200,100,0.25)',
                    borderRadius: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#00c864', fontSize: 12 }}>✓</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--white)' }}>
                      {f1tvEmail ? `Signed in as ${f1tvEmail}` : 'F1TV connected'}
                    </span>
                  </div>
                  <button
                    onClick={handleF1TVSignOut}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                      padding: 0,
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : authPending ? (
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--bg3)',
                    border: '0.5px solid var(--border2)',
                    borderRadius: 3,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--muted)',
                      marginBottom: 8,
                    }}
                  >
                    Waiting for F1TV sign-in…
                  </div>
                  {authInstructions && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(242,240,235,0.45)',
                        lineHeight: 1.7,
                        marginBottom: 8,
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {authInstructions}
                    </div>
                  )}
                  {authLoginUrl && (
                    <button
                      onClick={() => window.electronAPI?.openExternal(authLoginUrl)}
                      className="interactive-button"
                      style={{
                        background: 'none',
                        border: 'none',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        color: 'var(--white)',
                        cursor: 'pointer',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                        padding: 0,
                      }}
                    >
                      Reopen browser
                    </button>
                  )}
                  <button
                    onClick={() => setAuthPending(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: 0,
                      marginLeft: 12,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleF1TVSignIn}
                  disabled={!bridgeReady}
                  className="interactive-button"
                  style={{
                    width: '100%',
                    background: bridgeReady ? 'var(--bg4)' : 'transparent',
                    border: '0.5px solid var(--border2)',
                    borderRadius: 3,
                    padding: '10px',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: bridgeReady ? 'var(--white)' : 'var(--muted2)',
                    cursor: bridgeReady ? 'pointer' : 'not-allowed',
                    transition: 'background 0.12s',
                  }}
                >
                  Sign in with F1TV
                </button>
              )}
            </div>

            <button
              onClick={handleFastF1Live}
              disabled={f1tvStatus !== 'authenticated'}
              className="interactive-button"
              style={primaryBtn(f1tvStatus === 'authenticated')}
            >
              Enable live timing
            </button>

            <button onClick={handleFastF1Historical} className="interactive-button" style={ghostBtn}>
              Continue with historical data
            </button>
          </>
        )}

        <div
          style={{
            marginTop: 24,
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
            lineHeight: 1.8,
            letterSpacing: '0.04em',
          }}
        >
          All credentials are stored locally. No Pitwall servers are involved.
        </div>
      </div>
    </div>
  )
}
