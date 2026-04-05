import { useState } from 'react'
import { validateApiKey } from '../api/openf1'
import { useSessionStore } from '../store/sessionStore'

export function ApiKeyOnboarding() {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error_invalid' | 'error_forbidden' | 'error_rate' | 'error_network'>('idle')
  const { setApiKey, setMode } = useSessionStore()

  async function handleValidate() {
    if (!key.trim()) return
    setStatus('loading')
    const result = await validateApiKey(key.trim())
    if (result === 'valid') {
      setApiKey(key.trim())
    } else if (result === 'invalid') {
      setStatus('error_invalid')
    } else if (result === 'forbidden') {
      setStatus('error_forbidden')
    } else if (result === 'rate_limited') {
      setStatus('error_rate')
    } else {
      setStatus('error_network')
    }
  }

  function handleHistorical() {
    setMode('historical')
  }

  return (
    <div className="animated-fade" style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animated-surface" style={{ width: 480, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ fontFamily: 'var(--cond)', fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1 }}>
          PIT<span style={{ color: 'var(--red)' }}>W</span>ALL
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 48 }}>
          F1 race intelligence platform
        </div>

        {/* Tier cards */}
         <div style={{ fontFamily: 'var(--cond)', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>OpenF1 API Tiers</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="interactive-card" style={{ background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 4, padding: '16px 18px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Historical</div>
            <div style={{ fontFamily: 'var(--cond)', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Free</div>
            <div style={{ fontSize: 11, color: 'rgba(242,240,235,0.55)', lineHeight: 1.6, fontWeight: 300 }}>
              2023–present sessions · all 33 widgets · no live updates
            </div>
          </div>
          <div className="interactive-card" style={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 4, padding: '16px 18px', borderLeft: '2px solid var(--red)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Live</div>
            <div style={{ fontFamily: 'var(--cond)', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>€10<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>/mo</span></div>
            <div style={{ fontSize: 11, color: 'rgba(242,240,235,0.55)', lineHeight: 1.6, fontWeight: 300 }}>
              ~3s real-time · team radio · all 18 endpoints
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em', minWidth:'0.5em' }}>
          Need live data access?{' '}
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

        

        {/* Key input */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>
            OpenF1 API key
          </div>
          <input
            type="text"
            value={key}
            onChange={(e) => { setKey(e.target.value); setStatus('idle') }}
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
            placeholder="Paste your OpenF1 subscriber key…"
            style={{
              width: '100%',
              background: 'var(--bg4)',
              border: `0.5px solid ${status.startsWith('error') ? 'var(--red)' : 'var(--border2)'}`,
              borderRadius: 3,
              padding: '10px 14px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--white)',
              outline: 'none',
            }}
          />
        </div>

        {/* Error messages */}
        {status === 'error_invalid' && (
          <div style={{ background: 'var(--red2)', border: '0.5px solid rgba(232,19,43,0.28)', borderRadius: 3, padding: '8px 12px', fontSize: 11, color: 'var(--red)', marginBottom: 10, fontFamily: 'var(--mono)' }}>
            Invalid API key — HTTP 401. Check openf1.org/account for your key.
          </div>
        )}
        {status === 'error_forbidden' && (
          <div style={{ background: 'var(--red2)', border: '0.5px solid rgba(232,19,43,0.28)', borderRadius: 3, padding: '8px 12px', fontSize: 11, color: 'var(--red)', marginBottom: 10, fontFamily: 'var(--mono)' }}>
            Subscription required — HTTP 403. Visit openf1.org/subscribe to upgrade.
          </div>
        )}
        {status === 'error_rate' && (
          <div style={{ background: 'rgba(224,144,0,0.1)', border: '0.5px solid rgba(224,144,0,0.3)', borderRadius: 3, padding: '8px 12px', fontSize: 11, color: 'var(--amber)', marginBottom: 10, fontFamily: 'var(--mono)' }}>
            Rate limit hit — wait 60 seconds and try again.
          </div>
        )}
        {status === 'error_network' && (
          <div style={{ background: 'rgba(74,74,79,0.2)', border: '0.5px solid var(--border2)', borderRadius: 3, padding: '8px 12px', fontSize: 11, color: 'var(--muted)', marginBottom: 10, fontFamily: 'var(--mono)' }}>
            Network error — check your connection, then try again.
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleValidate}
          disabled={!key.trim() || status === 'loading'}
          className="interactive-button"
          style={{
            width: '100%',
            background: key.trim() && status !== 'loading' ? 'var(--red)' : 'rgba(232,19,43,0.2)',
            border: 'none',
            borderRadius: 3,
            padding: '11px',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--white)',
            cursor: key.trim() && status !== 'loading' ? 'pointer' : 'not-allowed',
            marginBottom: 8,
            transition: 'background 0.15s',
          }}
        >
          {status === 'loading' ? 'Validating…' : 'Enable live mode'}
        </button>

        <button
          onClick={handleHistorical}
          className="interactive-button"
          style={{
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
          }}
        >
          Continue with historical data
        </button>

        <div style={{ marginTop: 24, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)', lineHeight: 1.8, letterSpacing: '0.04em' }}>
          Your key is stored locally, there are no Pitwall servers. All API calls go directly from your the application to api.openf1.org.
        </div>
      </div>
    </div>
  )
}
