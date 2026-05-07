import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { DriverTab } from './DriverTab'
import { FormulaTab } from './FormulaTab'
import type { DriverContext } from '../../store/workspaceStore'
import { useDriverStore } from '../../store/driverStore'
import { SmoothScrollContainer } from '../SmoothScrollContainer'

// Widget types that expose a formula tab
const INFERRED_WIDGET_TYPES = [
  'TyreIntelligence',
  'StintPaceComparison',
  'ERSMicroSectors',
  'DRSEfficiency',
  'EngineModeTracker',
  'DegRateGraph',
  'PitWindowUrgency',
  'UndercutSimulator',
  'ChampionshipCalculator',
  'CarVisualization',
]

// Default formula for TyreIntelligence
const TYRE_DEFAULT_FORMULA =
  `CLIFF_LAP = stint_start\n` +
  `  + BASE_WINDOW[compound]\n` +
  `  - (track_temp - 45) * 0.3\n` +
  `  - deg_rate * 1.8\n` +
  `  + sc_laps * 2.1`

const DRIVER_CONTEXT_OPTIONS: DriverContext[] = ['FOCUS', 'P1', 'P2', 'P3', 'P4', 'P5', 'GAP+1', 'GAP-1']

interface MultiDriverField {
  key: string
  label: string
  defaultValue: DriverContext
}

const MULTI_DRIVER_WIDGET_FIELDS: Partial<Record<string, MultiDriverField[]>> = {
  GapEvolutionChart: [{ key: 'comparisonDriverContext', label: 'Comparison driver', defaultValue: 'P1' }],
  HeadToHeadDelta: [{ key: 'comparisonDriverContext', label: 'Opponent driver', defaultValue: 'P1' }],
  StintPaceComparison: [{ key: 'comparisonDriverContext', label: 'Comparison driver', defaultValue: 'P2' }],
}

type TabId = 'display' | 'driver' | 'formula' | 'advanced'

interface WidgetSettingsPanelProps {
  widgetId: string
  onClose: () => void
}

export function WidgetSettingsPanel({ widgetId, onClose }: WidgetSettingsPanelProps) {
  const EXIT_MS = 220
  const [activeTab, setActiveTab] = useState<TabId>('display')
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    }
  }, [])

  const tabs = useWorkspaceStore((s) => s.tabs)
  const updateWidgetConfig = useWorkspaceStore((s) => s.updateWidgetConfig)
  const starred = useDriverStore((s) => s.starred)

  // Find the tab + widget config
  let tabId: string | undefined
  let widgetConfig = undefined as ReturnType<typeof useWorkspaceStore.getState>['tabs'][0]['widgets'][string] | undefined

  for (const tab of tabs) {
    if (tab.widgets[widgetId]) {
      tabId = tab.id
      widgetConfig = tab.widgets[widgetId]
      const layoutItem = tab.layout.find((l) => l.i === widgetId)
      if (layoutItem) {
        // attached for display
      }
    }
  }

  // Get layout item for size display
  const layoutItem = tabs
    .flatMap((t) => t.layout)
    .find((l) => l.i === widgetId)

  if (!widgetConfig || !tabId) return null

  const isInferred = INFERRED_WIDGET_TYPES.includes(widgetConfig.type)
  const multiDriverFields = MULTI_DRIVER_WIDGET_FIELDS[widgetConfig.type] ?? []
  const formula = (widgetConfig.settings?.formula as string) ?? TYRE_DEFAULT_FORMULA
  const label = (widgetConfig.settings?.label as string) ?? widgetConfig.type
  const pollingRate = (widgetConfig.settings?.pollingRate as number) ?? 3000

  function update(partial: Partial<Record<string, unknown>>) {
    updateWidgetConfig(tabId!, widgetId, {
      settings: { ...widgetConfig!.settings, ...partial },
    })
  }

  const driverSelectOptions = [
    ...DRIVER_CONTEXT_OPTIONS.map((ctx) => ({ value: ctx, label: ctx })),
    ...starred.map((num) => ({ value: `PINNED:${num}` as DriverContext, label: `PINNED:${num}` })),
  ]

  const tabStyle = (t: TabId) => ({
    fontFamily: 'var(--mono)' as const,
    fontSize: 9,
    letterSpacing: '0.12em' as const,
    textTransform: 'uppercase' as const,
    color: activeTab === t ? 'var(--white)' : 'var(--muted)',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === t ? '1px solid var(--white)' : '1px solid transparent',
    cursor: 'pointer',
    padding: '8px 0',
    marginRight: 16,
  })

  return (
    // Overlay (doesn't close on click — use the × button)
    <div className={isClosing ? 'animated-slide-right-exit' : 'animated-slide-right'} style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 300,
      background: 'var(--bg3)',
      borderLeft: '0.5px solid var(--border2)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 150,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 0',
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted2)',
            flex: 1,
          }}>
            Widget settings
          </span>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
          }}>
            {widgetConfig.type}
          </span>
          <button
            onClick={handleRequestClose}
            className="interactive-button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 2px',
              lineHeight: 1,
            }}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex' }}>
          <button className="interactive-chip" style={tabStyle('display')} onClick={() => setActiveTab('display')}>Display</button>
          <button className="interactive-chip" style={tabStyle('driver')} onClick={() => setActiveTab('driver')}>Driver</button>
          {isInferred && (
            <button className="interactive-chip" style={tabStyle('formula')} onClick={() => setActiveTab('formula')}>Formula</button>
          )}
          <button className="interactive-chip" style={tabStyle('advanced')} onClick={() => setActiveTab('advanced')}>Advanced</button>
        </div>
      </div>

      {/* Tab content */}
      <SmoothScrollContainer style={{ flex: 1 }} innerStyle={{ padding: 16 }}>
        {activeTab === 'display' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
                marginBottom: 6,
              }}>
                Widget label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => update({ label: e.target.value })}
                style={{
                  width: '100%',
                  background: 'var(--bg4)',
                  border: '0.5px solid var(--border2)',
                  borderRadius: 3,
                  padding: '7px 10px',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--white)',
                  outline: 'none',
                }}
              />
            </div>

            {widgetConfig.type === 'ThrottleHeatmap' && (
              <div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--muted2)',
                  marginBottom: 6,
                }}>
                  Throttle heatmap
                </div>

                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', marginBottom: 6 }}>Micro-sector count</label>
                <input
                  type="number"
                  min={4}
                  max={64}
                  step={1}
                  value={(widgetConfig.settings?.bucketCount as number) ?? 16}
                  onChange={(e) => update({ bucketCount: Math.max(1, parseInt(e.target.value, 10) || 16) })}
                  style={{
                    width: '100%',
                    background: 'var(--bg4)',
                    border: '0.5px solid var(--border2)',
                    borderRadius: 3,
                    padding: '7px 10px',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: 'var(--white)',
                    outline: 'none',
                    marginBottom: 8,
                  }}
                />

                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', marginBottom: 6 }}>Max samples (rolling)</label>
                <input
                  type="number"
                  min={16}
                  max={1024}
                  step={8}
                  value={(widgetConfig.settings?.maxSamples as number) ?? 80}
                  onChange={(e) => update({ maxSamples: Math.max(1, parseInt(e.target.value, 10) || 80) })}
                  style={{
                    width: '100%',
                    background: 'var(--bg4)',
                    border: '0.5px solid var(--border2)',
                    borderRadius: 3,
                    padding: '7px 10px',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: 'var(--white)',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
                marginBottom: 6,
              }}>
                Units
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['s', 'ms'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => update({ units: u })}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 3,
                      border: `0.5px solid ${(widgetConfig.settings?.units ?? 's') === u ? 'var(--border3)' : 'var(--border)'}`,
                      background: (widgetConfig.settings?.units ?? 's') === u ? 'var(--bg4)' : 'transparent',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: (widgetConfig.settings?.units ?? 's') === u ? 'var(--white)' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {u}
                  </button>
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
                marginBottom: 6,
              }}>
                Size (read-only)
              </div>
              <div style={{
                padding: '6px 10px',
                background: 'var(--bg)',
                borderRadius: 3,
                border: '0.5px solid var(--border)',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--muted)',
              }}>
                {layoutItem
                  ? `${layoutItem.w} × ${layoutItem.h} grid units`
                  : 'Not placed'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'driver' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DriverTab
              value={widgetConfig.driverContext}
              onChange={(ctx: DriverContext) =>
                updateWidgetConfig(tabId!, widgetId, { driverContext: ctx })
              }
              widgetId={widgetId}
            />

            {multiDriverFields.length > 0 && (
              <div
                style={{
                  marginTop: 2,
                  paddingTop: 10,
                  borderTop: '0.5px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted2)',
                  }}
                >
                  Multi-driver selectors
                </div>

                {multiDriverFields.map((field) => {
                  const rawValue = widgetConfig.settings?.[field.key]
                  const configuredValue =
                    typeof rawValue === 'string' ? (rawValue as DriverContext) : field.defaultValue

                  const hasValueOption = driverSelectOptions.some((opt) => opt.value === configuredValue)
                  const safeValue = hasValueOption ? configuredValue : field.defaultValue

                  return (
                    <div key={field.key}>
                      <label
                        style={{
                          display: 'block',
                          fontFamily: 'var(--mono)',
                          fontSize: 8,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--muted2)',
                          marginBottom: 6,
                        }}
                      >
                        {field.label}
                      </label>

                      <select
                        value={safeValue}
                        onChange={(e) => update({ [field.key]: e.target.value as DriverContext })}
                        style={{
                          width: '100%',
                          background: 'var(--bg4)',
                          border: '0.5px solid var(--border2)',
                          borderRadius: 3,
                          padding: '7px 10px',
                          fontFamily: 'var(--mono)',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          color: 'var(--white)',
                          outline: 'none',
                        }}
                      >
                        {driverSelectOptions.map((opt) => (
                          <option key={`${field.key}-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'formula' && isInferred && (
          <FormulaTab
            formula={formula}
            onChange={(f) => update({ formula: f })}
            defaultFormula={TYRE_DEFAULT_FORMULA}
          />
        )}

        {activeTab === 'advanced' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
                marginBottom: 6,
              }}>
                Polling rate (ms)
              </label>
              <input
                type="number"
                value={pollingRate}
                min={1000}
                max={60000}
                step={500}
                onChange={(e) => update({ pollingRate: parseInt(e.target.value, 10) })}
                style={{
                  width: '100%',
                  background: 'var(--bg4)',
                  border: '0.5px solid var(--border2)',
                  borderRadius: 3,
                  padding: '7px 10px',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--white)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted2)',
                marginBottom: 8,
              }}>
                Layout
              </div>
              <button
                onClick={() => {
                  // Reset to default layout position — handled by removing and re-adding
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 3,
                  border: '0.5px solid var(--border2)',
                  background: 'transparent',
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Reset position
              </button>
            </div>
          </div>
        )}
      </SmoothScrollContainer>
    </div>
  )
}
