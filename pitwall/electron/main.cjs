const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron')
const nodeFs = require('fs')
const fs = require('fs/promises')
const path = require('path')
const { spawn } = require('child_process')
const f1store = require('./f1store.cjs')

const isDev = process.env.VITE_DEV_SERVER_URL != null
const mainWindows = new Set()

// ---------------------------------------------------------------------------
// FastF1 Python sidecar
// ---------------------------------------------------------------------------

let fastf1Process = null

// Ordered list of Python executables to try. On Windows 'py' is the Python Launcher.
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['python', 'python3', 'py']
  : ['python3', 'python']

function trySpawnFastF1(scriptPath, candidates) {
  if (candidates.length === 0) {
    console.warn('[FastF1] No Python executable found. Install Python 3.9+ and run: npm run fastf1:install')
    return
  }

  const [cmd, ...rest] = candidates
  const proc = spawn(cmd, [scriptPath], { stdio: ['ignore', 'pipe', 'pipe'] })

  proc.stdout.on('data', (d) => process.stdout.write(`[FastF1] ${d}`))

  let stderrBuf = ''
  proc.stderr.on('data', (d) => {
    const s = d.toString()
    stderrBuf += s
    process.stderr.write(`[FastF1] ${s}`)
  })

  proc.on('error', () => {
    // This Python command isn't on PATH — try the next one
    trySpawnFastF1(scriptPath, rest)
  })

  proc.on('exit', (code) => {
    if (code !== 0 && stderrBuf.includes('ModuleNotFoundError')) {
      console.warn('[FastF1] Missing Python dependencies. Run: npm run fastf1:install')
    }
    if (!isAppQuitting && code !== 0) {
      console.warn(`[FastF1] Sidecar exited with code ${code}`)
    }
    fastf1Process = null
  })

  fastf1Process = proc
}

function startFastF1Server() {
  const scriptPath = isDev
    ? path.join(__dirname, '../bridge/fastf1_server/main.py')
    : path.join(process.resourcesPath, 'fastf1_server/main.py')

  if (!nodeFs.existsSync(scriptPath)) {
    console.warn('[FastF1] main.py not found at', scriptPath, '— sidecar not started')
    return
  }

  trySpawnFastF1(scriptPath, PYTHON_CANDIDATES)
}

function stopFastF1Server() {
  if (fastf1Process && !fastf1Process.killed) {
    fastf1Process.kill()
    fastf1Process = null
  }
}
let devControlWindow = null
let reusablePopoutWindow = null
let isAppQuitting = false
const MAX_WARM_POPOUT_WINDOWS = 1
const pendingBootstrapByWebContentsId = new Map()
const windowKindByWebContentsId = new Map()
const MAIN_WINDOW_MIN_WIDTH = 1072
const MAIN_WINDOW_MIN_HEIGHT = 600
const POPOUT_WINDOW_MIN_WIDTH = 280
const POPOUT_WINDOW_MIN_HEIGHT = 180

function resolveAppIconPath() {
  const winCandidates = isDev
    ? [
        path.join(__dirname, '../public/branding/pitwall-monogram.ico'),
        path.join(__dirname, '../public/branding/pitwall-monogram-256.png'),
      ]
    : [
        path.join(__dirname, '../dist/branding/pitwall-monogram.ico'),
        path.join(__dirname, '../dist/branding/pitwall-monogram-256.png'),
      ]

  const nonWinCandidates = isDev
    ? [
        path.join(__dirname, '../public/branding/pitwall-monogram.svg'),
        path.join(__dirname, '../public/branding/pitwall-monogram-256.png'),
      ]
    : [
        path.join(__dirname, '../dist/branding/pitwall-monogram.svg'),
        path.join(__dirname, '../dist/branding/pitwall-monogram-256.png'),
      ]

  const candidates = process.platform === 'win32'
    ? winCandidates
    : nonWinCandidates

  for (const iconPath of candidates) {
    if (nodeFs.existsSync(iconPath)) return iconPath
  }

  return undefined
}

const appIconPath = resolveAppIconPath()

function maybeSendBootstrapWidget(win, payload) {
  if (!payload || typeof payload !== 'object') return
  if (win.isDestroyed() || win.webContents.isDestroyed()) return
  pendingBootstrapByWebContentsId.set(win.webContents.id, payload)
  win.webContents.send('window-bootstrap-widget', payload)
}

function resetReusablePopoutRenderer(win) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
  pendingBootstrapByWebContentsId.delete(win.webContents.id)
  win.webContents.send('window-reset-popout-state')
}

function hideReusablePopoutWindow(win) {
  if (!win || win.isDestroyed()) return
  clearPopoutDockPreviewForMainWindows()
  resetReusablePopoutRenderer(win)
  if (win.isVisible()) {
    win.hide()
  }
}

function applyPopoutWindowBounds(win, options = {}, fallbackX = 100, fallbackY = 100) {
  if (!win || win.isDestroyed()) return

  const normalizeNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
  const rawBounds = options && typeof options === 'object' ? options.popoutBounds : undefined
  const bounds = rawBounds && typeof rawBounds === 'object'
    ? {
        x: normalizeNumber(rawBounds.x),
        y: normalizeNumber(rawBounds.y),
        width: normalizeNumber(rawBounds.width),
        height: normalizeNumber(rawBounds.height),
      }
    : undefined

  const requestedWidth = bounds?.width ? Math.max(POPOUT_WINDOW_MIN_WIDTH, Math.round(bounds.width)) : undefined
  const requestedHeight = bounds?.height ? Math.max(POPOUT_WINDOW_MIN_HEIGHT, Math.round(bounds.height)) : undefined

  const width = requestedWidth ?? Math.max(POPOUT_WINDOW_MIN_WIDTH, win.getSize()[0])
  const height = requestedHeight ?? Math.max(POPOUT_WINDOW_MIN_HEIGHT, win.getSize()[1])
  const x = bounds?.x ?? fallbackX
  const y = bounds?.y ?? fallbackY

  win.setBounds({ x, y, width, height })
}

function finalizeWindowStartup(win, options = {}) {
  const { bootstrapWidget } = options
  const isWidgetPopout = options.windowKind === 'widget-popout' || Boolean(bootstrapWidget)
  const shouldAutoShow = options.show !== false
  const fallbackDelayMs = isWidgetPopout ? 350 : 2500
  let bootstrapSent = false

  const sendBootstrapOnce = () => {
    if (bootstrapSent) return
    maybeSendBootstrapWidget(win, bootstrapWidget)
    bootstrapSent = true
  }

  const showIfNeeded = () => {
    if (!shouldAutoShow) return
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show()
    }
  }

  // Show as soon as the renderer has finished loading the document.
  // This is typically faster than waiting for ready-to-show (first full paint).
  win.webContents.once('dom-ready', () => {
    sendBootstrapOnce()
    showIfNeeded()
  })

  // Show as soon as the renderer has finished loading the document.
  // This is typically faster than waiting for ready-to-show (first full paint).
  win.webContents.once('did-finish-load', () => {
    sendBootstrapOnce()
    showIfNeeded()
  })

  // Keep ready-to-show as a secondary safety net.
  win.once('ready-to-show', () => {
    sendBootstrapOnce()
    showIfNeeded()
  })

  // Fallback in case lifecycle events are delayed.
  setTimeout(() => {
    sendBootstrapOnce()
    showIfNeeded()
  }, fallbackDelayMs)
}

function createWindow(options = {}) {
  const isWidgetPopout = options.windowKind === 'widget-popout' || Boolean(options.bootstrapWidget)
  const bootstrapWidgetType = options.bootstrapWidget
    && typeof options.bootstrapWidget === 'object'
    && options.bootstrapWidget.widget
    && typeof options.bootstrapWidget.widget === 'object'
    && typeof options.bootstrapWidget.widget.type === 'string'
      ? options.bootstrapWidget.widget.type
      : undefined
  const windowKind = isWidgetPopout ? 'widget-popout' : 'main'
  const minWidth = isWidgetPopout ? POPOUT_WINDOW_MIN_WIDTH : MAIN_WINDOW_MIN_WIDTH
  const minHeight = isWidgetPopout ? POPOUT_WINDOW_MIN_HEIGHT : MAIN_WINDOW_MIN_HEIGHT
  const requestedWidth = typeof options.width === 'number' && Number.isFinite(options.width)
    ? Math.round(options.width)
    : undefined
  const requestedHeight = typeof options.height === 'number' && Number.isFinite(options.height)
    ? Math.round(options.height)
    : undefined
  const win = new BrowserWindow({
    width: requestedWidth != null
      ? Math.max(minWidth, requestedWidth)
      : (isWidgetPopout ? 640 : 1440),
    height: requestedHeight != null
      ? Math.max(minHeight, requestedHeight)
      : (isWidgetPopout ? 420 : 900),
    x: options.x,
    y: options.y,
    minWidth,
    minHeight,
    backgroundColor: '#0B0B0C',
    show: typeof options.show === 'boolean' ? options.show : isWidgetPopout,
    title: 'PITWALL',
    frame: !isWidgetPopout,
    titleBarStyle: isWidgetPopout ? 'hidden' : 'hiddenInset',
    titleBarOverlay: isWidgetPopout ? false : undefined,
    useContentSize: isWidgetPopout,
    autoHideMenuBar: isWidgetPopout,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })
  const webContentsId = win.webContents.id
  windowKindByWebContentsId.set(webContentsId, windowKind)
  if (options.bootstrapWidget && typeof options.bootstrapWidget === 'object') {
    pendingBootstrapByWebContentsId.set(webContentsId, options.bootstrapWidget)
  }

  if (isWidgetPopout) {
    win.removeMenu()
    win.setMenuBarVisibility(false)

    let isMoving = false
    win.on('move', () => {
      emitPopoutDockPreview(win)
    })

    win.on('will-move', () => {
      isMoving = true
    })

    win.on('moved', () => {
      if (!isMoving) return
      isMoving = false
      const previewTarget = emitPopoutDockPreview(win)
      if (!previewTarget) return
      tryAutoDockPopoutWindow(win, previewTarget)
    })

    win.on('closed', () => {
      clearPopoutDockPreviewForMainWindows()
    })

    if (options.reusablePopout) {
      if (
        MAX_WARM_POPOUT_WINDOWS === 1
        && reusablePopoutWindow
        && reusablePopoutWindow !== win
        && !reusablePopoutWindow.isDestroyed()
      ) {
        reusablePopoutWindow.destroy()
      }

      reusablePopoutWindow = win
      win.on('close', (event) => {
        if (isAppQuitting) return
        event.preventDefault()
        hideReusablePopoutWindow(win)
      })
    }
  }

  if (isDev) {
    const targetUrl = isWidgetPopout
      ? `${process.env.VITE_DEV_SERVER_URL}?windowKind=widget-popout${bootstrapWidgetType ? `&widgetType=${encodeURIComponent(bootstrapWidgetType)}` : ''}`
      : process.env.VITE_DEV_SERVER_URL
    win.loadURL(targetUrl)
    // Only open DevTools on the first window
    if (BrowserWindow.getAllWindows().length === 0) {
      win.webContents.openDevTools()
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: isWidgetPopout
        ? {
            windowKind: 'widget-popout',
            ...(bootstrapWidgetType ? { widgetType: bootstrapWidgetType } : {}),
          }
        : undefined,
    })
  }

  finalizeWindowStartup(win, options)

  mainWindows.add(win)
  win.on('closed', () => {
    const closedWindowKind = windowKindByWebContentsId.get(webContentsId)
    pendingBootstrapByWebContentsId.delete(webContentsId)
    windowKindByWebContentsId.delete(webContentsId)
    mainWindows.delete(win)

    if (reusablePopoutWindow === win) {
      reusablePopoutWindow = null
      return
    }

    if (
      !isAppQuitting
      && closedWindowKind === 'main'
      && getOpenMainWindowCount() === 0
      && reusablePopoutWindow
      && !reusablePopoutWindow.isDestroyed()
    ) {
      reusablePopoutWindow.destroy()
    }
  })

  win.on('focus', () => {
    if (!win.isDestroyed()) win.webContents.send('window-focus-change', true)
  })

  win.on('blur', () => {
    if (!win.isDestroyed()) win.webContents.send('window-focus-change', false)
  })

  // Open external links in browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

function ensureReusablePopoutWindow() {
  if (MAX_WARM_POPOUT_WINDOWS <= 0) return null

  if (reusablePopoutWindow && !reusablePopoutWindow.isDestroyed()) {
    return reusablePopoutWindow
  }

  return createWindow({
    windowKind: 'widget-popout',
    show: false,
    reusablePopout: true,
  })
}

function getOpenMainWindowCount() {
  let count = 0
  for (const win of mainWindows) {
    if (win.isDestroyed()) continue
    if (windowKindByWebContentsId.get(win.webContents.id) === 'main') {
      count += 1
    }
  }
  return count
}

function createDevControlWindow() {
  if (devControlWindow && !devControlWindow.isDestroyed()) {
    devControlWindow.focus()
    return devControlWindow
  }

  devControlWindow = new BrowserWindow({
    width: 560,
    height: 520,
    minWidth: 520,
    minHeight: 420,
    resizable: true,
    title: 'Developer Menu',
    icon: appIconPath,
    backgroundColor: '#111216',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'devtools-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  devControlWindow.loadFile(path.join(__dirname, 'devtools.html'))

  devControlWindow.on('closed', () => {
    devControlWindow = null
  })

  return devControlWindow
}

function buildAppMenu() {
  const sendToFocusedWindow = (action, payload) => {
    const focused = BrowserWindow.getFocusedWindow()
    if (focused && !focused.isDestroyed()) {
      focused.webContents.send('debug-action', { action, payload })
      return
    }
    broadcastDebugAction(action, payload)
  }

  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow()
            const [x, y] = focused ? focused.getPosition() : [100, 100]
            createWindow({ x: x + 30, y: y + 30 })
          },
        },
        { type: 'separator' },
        {
          label: 'Open Session Browser',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToFocusedWindow('open-session-browser'),
        },
        {
          label: 'Open Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToFocusedWindow('open-settings'),
        },
        {
          label: 'Toggle Log Panel',
          accelerator: 'CmdOrCtrl+L',
          click: () => sendToFocusedWindow('toggle-log-panel'),
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(process.platform === 'darwin'
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
              },
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Open Developer Menu',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => createDevControlWindow(),
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://www.electronjs.org')
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function broadcastDebugAction(action, payload) {
  for (const win of mainWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('debug-action', { action, payload })
    }
  }
}

function pickMainWorkspaceTargetWindow(senderWindow) {
  const focused = BrowserWindow.getFocusedWindow()
  if (
    focused
    && !focused.isDestroyed()
    && windowKindByWebContentsId.get(focused.webContents.id) === 'main'
    && focused !== senderWindow
  ) {
    return focused
  }

  for (const win of mainWindows) {
    if (win.isDestroyed()) continue
    if (win === senderWindow) continue
    if (windowKindByWebContentsId.get(win.webContents.id) === 'main') {
      return win
    }
  }

  return null
}

function pickMainWorkspaceTargetWindowByPoint(x, y, senderWindow) {
  for (const win of mainWindows) {
    if (win.isDestroyed()) continue
    if (win === senderWindow) continue
    if (windowKindByWebContentsId.get(win.webContents.id) !== 'main') continue

    const [left, top] = win.getPosition()
    const [width, height] = win.getSize()
    const right = left + width
    const bottom = top + height
    if (x >= left && x <= right && y >= top && y <= bottom) {
      return win
    }
  }

  return null
}

function clearPopoutDockPreviewForMainWindows() {
  for (const win of mainWindows) {
    if (win.isDestroyed()) continue
    if (windowKindByWebContentsId.get(win.webContents.id) !== 'main') continue
    win.webContents.send('popout-dock-preview', { visible: false })
  }
}

function computeDockGridForMainWindow(targetWindow, centerX, centerY, layout) {
  const GRID_COLS = 24
  const GRID_ROW_HEIGHT = 40
  const GRID_MARGIN_X = 4
  const GRID_MARGIN_Y = 4
  const MAIN_TOP_CHROME_HEIGHT = 102

  if (!targetWindow || targetWindow.isDestroyed()) return null

  const [left, top] = targetWindow.getPosition()
  const [width] = targetWindow.getSize()
  const w = Math.max(1, Math.min(GRID_COLS, Math.round(layout?.w ?? 6)))
  const h = Math.max(1, Math.round(layout?.h ?? 6))

  const localX = centerX - left
  const localY = centerY - top - MAIN_TOP_CHROME_HEIGHT
  const colWidth = (width - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS
  if (!Number.isFinite(colWidth) || colWidth <= 0) {
    return { x: 0, y: 0 }
  }

  const itemWidthPx = w * colWidth + (w - 1) * GRID_MARGIN_X
  const itemHeightPx = h * GRID_ROW_HEIGHT + (h - 1) * GRID_MARGIN_Y
  const stepX = colWidth + GRID_MARGIN_X
  const stepY = GRID_ROW_HEIGHT + GRID_MARGIN_Y

  const x = Math.max(0, Math.min(GRID_COLS - w, Math.round((localX - itemWidthPx / 2) / stepX)))
  const y = Math.max(0, Math.round((localY - itemHeightPx / 2) / stepY))
  return { x, y }
}

function emitPopoutDockPreview(win) {
  if (!win || win.isDestroyed()) {
    clearPopoutDockPreviewForMainWindows()
    return null
  }

  const payload = pendingBootstrapByWebContentsId.get(win.webContents.id)
  if (!payload || typeof payload !== 'object') {
    clearPopoutDockPreviewForMainWindows()
    return null
  }

  const [x, y] = win.getPosition()
  const [width, height] = win.getSize()
  const centerX = x + Math.round(width / 2)
  const centerY = y + Math.round(height / 2)
  const target = pickMainWorkspaceTargetWindowByPoint(centerX, centerY, win)

  for (const candidate of mainWindows) {
    if (candidate.isDestroyed()) continue
    if (windowKindByWebContentsId.get(candidate.webContents.id) !== 'main') continue

    if (candidate === target) {
      const layout = payload.layout && typeof payload.layout === 'object' ? payload.layout : {}
      candidate.webContents.send('popout-dock-preview', {
        visible: true,
        centerX,
        centerY,
        layout: {
          w: typeof layout.w === 'number' ? layout.w : 6,
          h: typeof layout.h === 'number' ? layout.h : 6,
        },
      })
    } else {
      candidate.webContents.send('popout-dock-preview', { visible: false })
    }
  }

  return target
}

function tryAutoDockPopoutWindow(win, preselectedTarget) {
  if (!win || win.isDestroyed()) return false
  if (windowKindByWebContentsId.get(win.webContents.id) !== 'widget-popout') return false

  const payload = pendingBootstrapByWebContentsId.get(win.webContents.id)
  if (!payload || typeof payload !== 'object') return false

  const [x, y] = win.getPosition()
  const [width, height] = win.getSize()
  const centerX = x + Math.round(width / 2)
  const centerY = y + Math.round(height / 2)

  const target = preselectedTarget ?? pickMainWorkspaceTargetWindowByPoint(centerX, centerY, win)
  if (!target) return false

  const dockGrid = computeDockGridForMainWindow(target, centerX, centerY, payload.layout)
  target.webContents.send('dock-widget-into-workspace', {
    transferWidget: payload,
    dockGrid,
  })
  clearPopoutDockPreviewForMainWindows()
  win.close()
  return true
}

app.whenReady().then(() => {
  app.setName('PITWALL')
  buildAppMenu()

  app.on('before-quit', () => {
    isAppQuitting = true
    stopFastF1Server()
  })

  // IPC handler: open a new window offset from the requesting window
  ipcMain.handle('open-new-window', (_event, options) => {
    const sender = BrowserWindow.fromWebContents(_event.sender)
    const [x, y] = sender ? sender.getPosition() : [100, 100]
    const bootstrapWidget = options && typeof options === 'object' ? options.transferWidget : undefined

    if (bootstrapWidget) {
      const warmWindow = ensureReusablePopoutWindow()
      if (warmWindow && !warmWindow.isDestroyed() && !warmWindow.isVisible()) {
        applyPopoutWindowBounds(warmWindow, options, x + 30, y + 30)
        maybeSendBootstrapWidget(warmWindow, bootstrapWidget)
        if (warmWindow.isMinimized()) warmWindow.restore()
        warmWindow.show()
        warmWindow.focus()
        return
      }
    }

    createWindow({
      x: x + 30,
      y: y + 30,
      ...(options && typeof options === 'object' && options.popoutBounds && typeof options.popoutBounds === 'object'
        ? {
            x: (typeof options.popoutBounds.x === 'number' && Number.isFinite(options.popoutBounds.x)) ? options.popoutBounds.x : x + 30,
            y: (typeof options.popoutBounds.y === 'number' && Number.isFinite(options.popoutBounds.y)) ? options.popoutBounds.y : y + 30,
            width: (typeof options.popoutBounds.width === 'number' && Number.isFinite(options.popoutBounds.width)) ? Math.max(POPOUT_WINDOW_MIN_WIDTH, Math.round(options.popoutBounds.width)) : undefined,
            height: (typeof options.popoutBounds.height === 'number' && Number.isFinite(options.popoutBounds.height)) ? Math.max(POPOUT_WINDOW_MIN_HEIGHT, Math.round(options.popoutBounds.height)) : undefined,
          }
        : {}),
      bootstrapWidget,
      windowKind: bootstrapWidget ? 'widget-popout' : undefined,
    })
  })

  ipcMain.handle('close-current-window', (_event) => {
    const sender = BrowserWindow.fromWebContents(_event.sender)
    if (!sender || sender.isDestroyed()) return

    if (sender === reusablePopoutWindow) {
      hideReusablePopoutWindow(sender)
      return
    }

    sender.close()
  })

  ipcMain.handle('dock-widget-to-main', (_event, rawPayload) => {
    const sender = BrowserWindow.fromWebContents(_event.sender)
    if (!sender || sender.isDestroyed()) return false
    if (!rawPayload || typeof rawPayload !== 'object') return false

    const target = pickMainWorkspaceTargetWindow(sender)
    if (!target) return false

    target.webContents.send('dock-widget-into-workspace', rawPayload)
    return true
  })

  ipcMain.handle('open-dev-control-window', () => {
    createDevControlWindow()
  })

  ipcMain.handle('consume-window-bootstrap-widget', (event) => {
    const payload = pendingBootstrapByWebContentsId.get(event.sender.id)
    if (!payload) return null
    return payload
  })

  ipcMain.handle('save-pitwall-file', async (_event, options) => {
    const defaultName =
      options && typeof options === 'object' && typeof options.defaultName === 'string'
        ? options.defaultName
        : 'pitwall-export.bundle.pitwall'
    const contents =
      options && typeof options === 'object' && typeof options.contents === 'string'
        ? options.contents
        : null

    if (contents == null) {
      throw new Error('Missing file contents for save-pitwall-file.')
    }

    const result = await dialog.showSaveDialog({
      title: 'Export Pitwall file',
      defaultPath: defaultName,
      filters: [{ name: 'Pitwall files', extensions: ['pitwall'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await fs.writeFile(result.filePath, contents, 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle('open-pitwall-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Pitwall file',
      filters: [{ name: 'Pitwall files', extensions: ['pitwall'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const contents = await fs.readFile(filePath, 'utf-8')
    return { canceled: false, filePath, contents }
  })

  ipcMain.on('debug-trigger-action', (_event, data) => {
    if (!data || typeof data.action !== 'string') return
    broadcastDebugAction(data.action, data.payload)
  })

  f1store.init()
  startFastF1Server()

  // ---------------------------------------------------------------------------
  // F1 persistent store IPC
  // ---------------------------------------------------------------------------

  ipcMain.handle('f1store-read', (_event, args) => {
    const { table, sessionKey, driverNumber } = args ?? {}
    return f1store.readCollection(table, sessionKey, driverNumber)
  })

  ipcMain.handle('f1store-write', (_event, args) => {
    const { table, sessionKey, rows, isComplete, driverNumber } = args ?? {}
    f1store.writeCollection(table, sessionKey, rows, isComplete, driverNumber)
  })

  ipcMain.handle('f1store-is-complete', (_event, args) => {
    const { table, sessionKey, driverNumber } = args ?? {}
    return f1store.isCollectionComplete(table, sessionKey, driverNumber)
  })

  ipcMain.handle('open-external', (_event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url)
    }
  })

  ipcMain.handle('fastf1-server-status', () => ({
    running: fastf1Process != null && !fastf1Process.killed,
  }))

  createWindow()
  ensureReusablePopoutWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    ensureReusablePopoutWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
