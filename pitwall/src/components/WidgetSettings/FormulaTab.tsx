const FORMULA_MAX_LENGTH = 2000

// Variables available to the TyreIntelligence formula (display-only annotation)
const FORMULA_VARIABLES: { name: string; description: string }[] = [
  { name: 'stint_start',       description: 'Lap the current stint began' },
  { name: 'BASE_WINDOW[cmp]',  description: 'Compound life window (S:18 M:28 H:40 I:35 W:50)' },
  { name: 'track_temp',        description: 'Track surface temperature (°C)' },
  { name: 'deg_rate',          description: 'Estimated degradation rate per lap' },
  { name: 'sc_laps',           description: 'Laps run under safety car (phase 1: 0)' },
  { name: 'tyre_age',          description: 'Current tyre age in laps' },
  { name: 'lap_count',         description: 'Total laps completed by driver' },
]

interface FormulaTabProps {
  formula: string
  onChange: (formula: string) => void
  defaultFormula: string
}

export function FormulaTab({ formula, onChange, defaultFormula }: FormulaTabProps) {
  const isModified = formula !== defaultFormula

  function handleChange(raw: string) {
    // Strip null bytes; cap length to prevent bloating persisted state
    const sanitized = raw.replace(/\0/g, '').slice(0, FORMULA_MAX_LENGTH)
    onChange(sanitized)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>

      {/* Variable reference */}
      <div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          marginBottom: 6,
        }}>
          Available variables
        </div>
        <div style={{
          background: 'var(--bg)',
          border: '0.5px solid var(--border)',
          borderRadius: 3,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}>
          {FORMULA_VARIABLES.map(({ name, description }) => (
            <div key={name} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <code style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--white)',
                flexShrink: 0,
                minWidth: 130,
              }}>
                {name}
              </code>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                color: 'var(--muted)',
                lineHeight: 1.4,
              }}>
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>Formula editor</span>
          <span style={{ color: isModified ? 'var(--amber)' : 'var(--muted2)' }}>
            {isModified ? 'Modified' : `${formula.length}/${FORMULA_MAX_LENGTH}`}
          </span>
        </div>
        <textarea
          value={formula}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 140,
            background: 'var(--bg)',
            border: '0.5px solid var(--border2)',
            borderRadius: 3,
            padding: '10px 12px',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--white)',
            lineHeight: 1.7,
            resize: 'vertical',
            outline: 'none',
            letterSpacing: '0.02em',
          }}
        />
      </div>

      {/* Live preview pane */}
      <div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
          marginBottom: 8,
        }}>
          Preview
        </div>
        <div style={{
          background: 'var(--bg)',
          border: '0.5px solid var(--border)',
          borderRadius: 3,
          padding: '12px',
          minHeight: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted2)',
            letterSpacing: '0.08em',
            textAlign: 'center',
          }}>
            Preview available for historical data
          </span>
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => onChange(defaultFormula)}
        disabled={!isModified}
        className="interactive-button"
        style={{
          alignSelf: 'flex-start',
          padding: '5px 12px',
          borderRadius: 3,
          border: '0.5px solid var(--border2)',
          background: isModified ? 'var(--bg4)' : 'transparent',
          fontFamily: 'var(--mono)',
          fontSize: 8,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: isModified ? 'var(--muted)' : 'var(--muted2)',
          cursor: isModified ? 'pointer' : 'not-allowed',
          transition: 'all 0.12s',
        }}
      >
        Reset to default
      </button>
    </div>
  )
}
