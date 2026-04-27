import { useAmbientStore } from '../store/ambientStore'
import { useLogStore } from '../store/logStore'
import { useSessionStore } from '../store/sessionStore'

type DebugActionMessage = {
  action: string
  payload?: unknown
}

const WINDOW_DIMENSIONS_OVERLAY_ID = 'pitwall-window-dimensions-overlay'
let dimensionsOverlayVisible = false

const LEADER_TEAM_PRESETS: Record<string, { driverNumber: number; color: string; name: string; driver: string }> = {
  ferrari: { driverNumber: 16, color: '#E8002D', name: 'Ferrari', driver: 'LEC' },
  mclaren: { driverNumber: 4, color: '#FF8000', name: 'McLaren', driver: 'NOR' },
  redbull: { driverNumber: 1, color: '#3671C6', name: 'Red Bull', driver: 'VER' },
  mercedes: { driverNumber: 63, color: '#00A0DD', name: 'Mercedes', driver: 'RUS' },
  aston: { driverNumber: 14, color: '#1AACB8', name: 'Aston Martin', driver: 'ALO' },
  alpine: { driverNumber: 10, color: '#52E252', name: 'Alpine', driver: 'GAS' },
  rb: { driverNumber: 22, color: '#C92D4B', name: 'RB', driver: 'TSU' },
  williams: { driverNumber: 23, color: '#64C4FF', name: 'Williams', driver: 'ALB' },
  haas: { driverNumber: 31, color: '#B6BABD', name: 'Haas', driver: 'OCO' },
  sauber: { driverNumber: 27, color: '#00E701', name: 'Kick Sauber', driver: 'HUL' },
}

function adjustHexLuminance(hex: string, factor: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  const r = clamp(parseInt(h.slice(0, 2), 16) * factor)
  const g = clamp(parseInt(h.slice(2, 4), 16) * factor)
  const b = clamp(parseInt(h.slice(4, 6), 16) * factor)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getDimensionsText(): string {
  return `${window.innerWidth}x${window.innerHeight} (inner) | ${window.outerWidth}x${window.outerHeight} (outer)`
}

function getDimensionsOverlayEl(): HTMLDivElement {
  let el = document.getElementById(WINDOW_DIMENSIONS_OVERLAY_ID) as HTMLDivElement | null
  if (el) return el

  el = document.createElement('div')
  el.id = WINDOW_DIMENSIONS_OVERLAY_ID
  el.style.position = 'fixed'
  el.style.left = '12px'
  el.style.bottom = '12px'
  el.style.padding = '6px 8px'
  el.style.borderRadius = '6px'
  el.style.border = '1px solid rgba(120, 224, 178, 0.45)'
  el.style.background = 'rgba(10, 16, 14, 0.84)'
  el.style.color = '#93f0c9'
  el.style.fontSize = '12px'
  el.style.lineHeight = '1.2'
  el.style.fontFamily = 'Consolas, SFMono-Regular, Menlo, Monaco, monospace'
  el.style.letterSpacing = '0.02em'
  el.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.35)'
  el.style.zIndex = '2147483647'
  el.style.pointerEvents = 'none'
  el.style.userSelect = 'none'
  el.style.whiteSpace = 'nowrap'
  document.body.appendChild(el)
  return el
}

function updateDimensionsOverlay() {
  if (!dimensionsOverlayVisible) return
  const el = getDimensionsOverlayEl()
  el.textContent = getDimensionsText()
}

function setDimensionsOverlayVisible(visible: boolean) {
  dimensionsOverlayVisible = visible

  if (visible) {
    const el = getDimensionsOverlayEl()
    el.style.display = 'block'
    updateDimensionsOverlay()
    window.addEventListener('resize', updateDimensionsOverlay)
    return
  }

  const el = document.getElementById(WINDOW_DIMENSIONS_OVERLAY_ID) as HTMLDivElement | null
  if (el) el.style.display = 'none'
  window.removeEventListener('resize', updateDimensionsOverlay)
}

function runDebugAction(action: string, payload?: unknown) {
  const ambient = useAmbientStore.getState()
  const session = useSessionStore.getState()
  const log = useLogStore.getState()

  switch (action) {
    case 'toast-sample':
      ambient.addToast('Developer test toast fired from Developer Menu.', 'YELLOW')
      log.addEntry('DBG', 'Triggered sample toast from Developer Menu.', 'devtools')
      break
    case 'simulate-rate-limit':
      ambient.addToast('OpenF1 rate limit reached. Requests are being throttled.', 'YELLOW')
      log.addEntry('WARN', 'Simulated OpenF1 429 rate-limit warning.', 'devtools')
      break
    case 'show-window-dimensions': {
      const nextVisible = !dimensionsOverlayVisible
      setDimensionsOverlayVisible(nextVisible)
      const message = nextVisible
        ? `Window dimensions overlay enabled: ${getDimensionsText()}`
        : 'Window dimensions overlay disabled.'
      ambient.addToast(message, nextVisible ? 'GREEN' : 'YELLOW')
      log.addEntry('DBG', `${message} from Developer Menu.`, 'devtools')
      break
    }
    case 'simulate-invalid-api-key':
      session.clearApiKey()
      session.setMode('onboarding')
      ambient.addToast('Simulated invalid API key. Returned to onboarding.', 'RED')
      log.addEntry('WARN', 'Simulated invalid API key (401) from Developer Menu.', 'devtools')
      break
    case 'set-mode-live':
      session.setMode('live')
      ambient.addToast('Mode switched to live.', 'GREEN')
      log.addEntry('DBG', 'Switched mode to live from Developer Menu.', 'devtools')
      break
    case 'set-mode-historical':
      session.setMode('historical')
      ambient.addToast('Mode switched to historical.', 'YELLOW')
      log.addEntry('DBG', 'Switched mode to historical from Developer Menu.', 'devtools')
      break
    case 'toggle-api-requests': {
      const nextEnabled = !session.apiRequestsEnabled
      session.setApiRequestsEnabled(nextEnabled)
      ambient.addToast(`API requests ${nextEnabled ? 'enabled' : 'disabled'}.`, nextEnabled ? 'GREEN' : 'YELLOW')
      log.addEntry(
        'DBG',
        `API requests ${nextEnabled ? 'enabled' : 'disabled'} from Developer Menu.`,
        'devtools'
      )
      break
    }
    case 'clear-diagnostic-log':
      log.clear()
      useLogStore.getState().addEntry('INFO', 'Diagnostic log cleared from Developer Menu.', 'devtools')
      break
    case 'ambient-layer-on':
      ambient.setAmbientLayerEnabled(true)
      ambient.addToast('Ambient layer enabled', 'GREEN')
      log.addEntry('DBG', 'Ambient layer enabled from Developer Menu.', 'devtools')
      break
    case 'ambient-layer-off':
      ambient.setAmbientLayerEnabled(false)
      ambient.addToast('Ambient layer disabled', 'YELLOW')
      log.addEntry('DBG', 'Ambient layer disabled from Developer Menu.', 'devtools')
      break
    case 'leader-color-mode-on':
      ambient.setLeaderColorMode(true)
      ambient.setFlagState('GREEN', 'Leader team color mode enabled')
      log.addEntry('DBG', 'Leader team color mode enabled from Developer Menu.', 'devtools')
      break
    case 'leader-color-mode-off':
      ambient.setLeaderColorMode(false)
      ambient.setFlagState('GREEN', 'Leader team color mode disabled')
      log.addEntry('DBG', 'Leader team color mode disabled from Developer Menu.', 'devtools')
      break
    case 'leader-color-mode-toggle': {
      const nextEnabled = !ambient.leaderColorMode
      ambient.setLeaderColorMode(nextEnabled)
      ambient.setFlagState('GREEN', `Leader team color mode ${nextEnabled ? 'enabled' : 'disabled'}`)
      log.addEntry(
        'DBG',
        `Leader team color mode ${nextEnabled ? 'enabled' : 'disabled'} from Developer Menu.`,
        'devtools'
      )
      break
    }
    case 'leader-team-ferrari':
    case 'leader-team-mclaren':
    case 'leader-team-redbull':
    case 'leader-team-mercedes':
    case 'leader-team-aston':
    case 'leader-team-alpine':
    case 'leader-team-rb':
    case 'leader-team-williams':
    case 'leader-team-haas':
    case 'leader-team-sauber': {
      const key = action.replace('leader-team-', '')
      const preset = LEADER_TEAM_PRESETS[key]
      if (!preset) break

      ambient.setLeaderColorMode(true)
      ambient.setLeader(preset.driverNumber, preset.color)
      ambient.setFlagState('GREEN', `${preset.driver} leads · ${preset.name} team color mode`)
      log.addEntry('DBG', `Leader team set to ${preset.name} from Developer Menu.`, 'devtools')
      break
    }
    case 'leader-variation-standard':
    case 'leader-variation-vivid':
    case 'leader-variation-soft': {
      const currentLeader = useAmbientStore.getState().leaderDriverNumber ?? 1
      const currentColor = useAmbientStore.getState().leaderColor ?? '#00C850'
      const factor = action === 'leader-variation-vivid' ? 1.2 : action === 'leader-variation-soft' ? 0.82 : 1
      const nextColor = adjustHexLuminance(currentColor, factor)

      ambient.setLeaderColorMode(true)
      ambient.setLeader(currentLeader, nextColor)
      ambient.setFlagState('GREEN', `Leader color variation: ${action.replace('leader-variation-', '')}`)
      log.addEntry('DBG', `Leader color variation applied (${action}).`, 'devtools')
      break
    }
    case 'ambient-intensity-low':
      ambient.setAmbientLayerIntensity(25)
      ambient.addToast('Ambient intensity: 25%', 'GREEN')
      log.addEntry('DBG', 'Ambient intensity set to 25 from Developer Menu.', 'devtools')
      break
    case 'ambient-intensity-high':
      ambient.setAmbientLayerIntensity(75)
      ambient.addToast('Ambient intensity: 75%', 'GREEN')
      log.addEntry('DBG', 'Ambient intensity set to 75 from Developer Menu.', 'devtools')
      break
    case 'ambient-intensity-25':
      ambient.setAmbientLayerIntensity(25)
      log.addEntry('DBG', 'Ambient intensity set to 25 from Developer Menu.', 'devtools')
      break
    case 'ambient-intensity-50':
      ambient.setAmbientLayerIntensity(50)
      log.addEntry('DBG', 'Ambient intensity set to 50 from Developer Menu.', 'devtools')
      break
    case 'ambient-intensity-75':
      ambient.setAmbientLayerIntensity(75)
      log.addEntry('DBG', 'Ambient intensity set to 75 from Developer Menu.', 'devtools')
      break
    case 'ambient-intensity-100':
      ambient.setAmbientLayerIntensity(100)
      log.addEntry('DBG', 'Ambient intensity set to 100 from Developer Menu.', 'devtools')
      break
    case 'banner-custom-message': {
      const msg = (payload as { message?: string })?.message
      if (msg && typeof msg === 'string') {
        const sanitized = msg.replace(/\0/g, '').slice(0, 120)
        useAmbientStore.setState({
          bannerMessage: { text: sanitized, id: crypto.randomUUID() },
        })
        log.addEntry('DBG', `Custom banner message fired: "${sanitized}"`, 'devtools')
      }
      break
    }
    case 'set-flag-none':
      ambient.setFlagState('NONE')
      log.addEntry('DBG', 'Flag set to NONE from Developer Menu.', 'devtools')
      break
    case 'set-flag-green':
      ambient.setFlagState('GREEN', 'Green flag')
      log.addEntry('DBG', 'Flag set to GREEN from Developer Menu.', 'devtools')
      break
    case 'set-flag-yellow':
      ambient.setFlagState('YELLOW', 'Yellow flag')
      log.addEntry('DBG', 'Flag set to YELLOW from Developer Menu.', 'devtools')
      break
    case 'set-flag-safety-car':
      ambient.setFlagState('SAFETY_CAR', 'Safety car deployed')
      log.addEntry('DBG', 'Flag set to SAFETY_CAR from Developer Menu.', 'devtools')
      break
    case 'set-flag-virtual-sc':
      ambient.setFlagState('VIRTUAL_SC', 'Virtual safety car deployed')
      log.addEntry('DBG', 'Flag set to VIRTUAL_SC from Developer Menu.', 'devtools')
      break
    case 'set-flag-red':
      ambient.setFlagState('RED', 'Red flag')
      log.addEntry('DBG', 'Flag set to RED from Developer Menu.', 'devtools')
      break
    case 'set-flag-fastest-lap':
      ambient.setFlagState('FASTEST_LAP', 'VER fastest lap 1:14.821')
      log.addEntry('DBG', 'Flag set to FASTEST_LAP from Developer Menu.', 'devtools')
      break
    case 'set-flag-checkered':
      ambient.setFlagState('CHECKERED', 'Chequered flag')
      log.addEntry('DBG', 'Flag set to CHECKERED from Developer Menu.', 'devtools')
      break
    case 'set-flag-calm':
      ambient.setFlagState('CALM', 'Calm period')
      log.addEntry('DBG', 'Flag set to CALM from Developer Menu.', 'devtools')
      break
    case 'set-flag-waiting-start':
      ambient.setFlagState('WAITING_FOR_START', 'Waiting for race start')
      log.addEntry('DBG', 'Flag set to WAITING_FOR_START from Developer Menu.', 'devtools')
      break
    case 'set-flag-national-anthem':
      ambient.setFlagState('NATIONAL_ANTHEM', 'National anthem')
      log.addEntry('DBG', 'Flag set to NATIONAL_ANTHEM from Developer Menu.', 'devtools')
      break
    case 'open-settings':
      window.dispatchEvent(new Event('pitwall-open-settings'))
      log.addEntry('DBG', 'Opened Settings from menu action.', 'devtools')
      break
    case 'open-session-browser':
      window.dispatchEvent(new Event('pitwall-open-session-browser'))
      log.addEntry('DBG', 'Opened Session Browser from menu action.', 'devtools')
      break
    case 'toggle-log-panel':
      window.dispatchEvent(new Event('pitwall-toggle-log-panel'))
      log.addEntry('DBG', 'Toggled Diagnostic Log from menu action.', 'devtools')
      break
    case 'trigger-live-mode-prompt':
      window.dispatchEvent(new Event('pitwall-trigger-live-mode-prompt'))
      log.addEntry('DBG', 'Triggered live mode prompt from Developer Menu.', 'devtools')
      break
    case 'loading-preview-toggle':
      window.dispatchEvent(new Event('pitwall-loading-preview-toggle'))
      log.addEntry('DBG', 'Toggled loading preview from Developer Menu.', 'devtools')
      break
    case 'loading-preview-start':
      window.dispatchEvent(new Event('pitwall-loading-preview-start'))
      log.addEntry('DBG', 'Started loading preview from Developer Menu.', 'devtools')
      break
    case 'loading-preview-reset':
      window.dispatchEvent(new Event('pitwall-loading-preview-reset'))
      log.addEntry('DBG', 'Reset loading preview progress from Developer Menu.', 'devtools')
      break
    case 'loading-preview-finish':
      window.dispatchEvent(new Event('pitwall-loading-preview-finish'))
      log.addEntry('DBG', 'Finished loading preview from Developer Menu.', 'devtools')
      break
    case 'loading-preview-advance-session':
      window.dispatchEvent(new CustomEvent('pitwall-loading-preview-advance-step', { detail: { step: 'sessionReady' } }))
      log.addEntry('DBG', 'Advanced loading preview: session step.', 'devtools')
      break
    case 'loading-preview-advance-drivers':
      window.dispatchEvent(new CustomEvent('pitwall-loading-preview-advance-step', { detail: { step: 'driversReady' } }))
      log.addEntry('DBG', 'Advanced loading preview: driver step.', 'devtools')
      break
    case 'loading-preview-advance-workspace':
      window.dispatchEvent(new CustomEvent('pitwall-loading-preview-advance-step', { detail: { step: 'workspaceReady' } }))
      log.addEntry('DBG', 'Advanced loading preview: workspace step.', 'devtools')
      break
    default:
      log.addEntry('WARN', `Unknown debug action: ${action}`, 'devtools')
  }
}

export function initElectronDebugBridge() {
  if (!window.electronAPI || typeof window.electronAPI.onDebugAction !== 'function') return

  window.electronAPI.onDebugAction((message: DebugActionMessage) => {
    if (!message || typeof message.action !== 'string') return
    runDebugAction(message.action, message.payload)
  })
}
