import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  checkFastF1Server,
  fetchFastF1Events,
  getFastF1AuthStatus,
  signOutFastF1,
  startFastF1Auth,
} from '../api/fastf1Bridge'
import { useSessionStore } from '../store/sessionStore'

export function ApiKeyOnboarding() {
  const { setMode, setF1TVAuth, setFastF1ServerAvailable, setOnboardingComplete } =
    useSessionStore()

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

  // Check bridge + F1TV status
  useEffect(() => {
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
  }, [setFastF1ServerAvailable, setF1TVAuth])

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

  // ── Race proximity (public endpoint, no key needed) ───────────────────────
  const year = new Date().getFullYear()
  const { data: onboardingEvents } = useQuery({
    queryKey: ['fastf1', 'events-onboarding', year],
    queryFn: () => fetchFastF1Events(year),
    enabled: bridgeReady === true,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const raceIsImminent = useMemo(() => {
    if (!onboardingEvents) return false
    const now = Date.now()
    const HOUR = 60 * 60 * 1000
    const raceSessions = onboardingEvents
      .flatMap((event) => event.sessions.map((session) => ({
        type: session.type,
        dateStart: session.date_start ?? event.date ?? null,
        dateEnd: session.date_end ?? session.date_start ?? event.date ?? null,
      })))
      .filter((s) => s.type === 'R' && s.dateStart)

    const next = raceSessions
      .filter((s) => new Date(s.dateEnd ?? s.dateStart!).getTime() > now - 30 * 60_000)
      .sort((a, b) => new Date(a.dateStart!).getTime() - new Date(b.dateStart!).getTime())[0]
    if (!next) return false
    const start = new Date(next.dateStart!).getTime()
    const end = new Date(next.dateEnd ?? next.dateStart!).getTime()
    const msToStart = start - now
    return (now >= start && now <= end) || msToStart <= HOUR
  }, [onboardingEvents])

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    setOnboardingComplete(true)
    setMode('hub')
  }

  function handleFastF1Live() {
    setOnboardingComplete(true)
    setMode('live')
  }

  function handleFastF1GetStarted() {
    setOnboardingComplete(true)
    setMode(f1tvStatus === 'authenticated' && raceIsImminent ? 'live' : 'hub')
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

        {/* ── FastF1 panel ─────────────────────────────────────────────── */}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <button
                onClick={handleFastF1Live}
                disabled={f1tvStatus !== 'authenticated'}
                className="interactive-button"
                style={{
                  background: 'transparent',
                  border: `0.5px solid ${f1tvStatus === 'authenticated' ? 'rgba(232,19,43,0.5)' : 'var(--border)'}`,
                  borderRadius: 3,
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: f1tvStatus === 'authenticated' ? 'pointer' : 'not-allowed',
                  opacity: f1tvStatus === 'authenticated' ? 1 : 0.45,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--white)' }}>
                    Live timing
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Direct SignalR feed during active race sessions
                </div>
              </button>

              <button
                onClick={handleFastF1Historical}
                className="interactive-button"
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--border)',
                  borderRadius: 3,
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
                  Historical only
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)', lineHeight: 1.6 }}>
                  Rich telemetry data from 2018–present
                </div>
              </button>
            </div>

            <button
              onClick={handleFastF1GetStarted}
              className="interactive-button"
              style={{
                width: '100%',
                background: 'var(--red)',
                border: 'none',
                borderRadius: 3,
                padding: '11px',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--white)',
                cursor: 'pointer',
                marginBottom: 10,
                transition: 'background 0.15s',
              }}
            >
              Get started
            </button>

            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)', letterSpacing: '0.04em' }}>
              Live timing only has data when a session is active · switch modes anytime from the toolbar
            </div>
        </>

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
