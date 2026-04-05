const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron')
const nodeFs = require('fs')
const fs = require('fs/promises')
const path = require('path')

const isDev = process.env.VITE_DEV_SERVER_URL != null
const mainWindows = new Set()
let devControlWindow = null
const pendingBootstrapByWebContentsId = new Map()

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

function finalizeWindowStartup(win, options = {}) {
  const { bootstrapWidget } = options
  let bootstrapSent = false

  const sendBootstrapOnce = () => {
    if (bootstrapSent) return
    maybeSendBootstrapWidget(win, bootstrapWidget)
    bootstrapSent = true
  }

  const showIfNeeded = () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show()
    }
  }

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
  }, 2500)
}

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width: options.width ?? 1440,
    height: options.height ?? 900,
    x: options.x,
    y: options.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0B0B0C',
    show: false,
    title: 'PITWALL',
    titleBarStyle: 'hiddenInset',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })
  const webContentsId = win.webContents.id

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Only open DevTools on the first window
    if (BrowserWindow.getAllWindows().length === 0) {
      win.webContents.openDevTools()
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  finalizeWindowStartup(win, options)

  mainWindows.add(win)
  win.on('closed', () => {
    pendingBootstrapByWebContentsId.delete(webContentsId)
    mainWindows.delete(win)
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

app.whenReady().then(() => {
  app.setName('PITWALL')
  buildAppMenu()

  // IPC handler: open a new window offset from the requesting window
  ipcMain.handle('open-new-window', (_event, options) => {
    const sender = BrowserWindow.fromWebContents(_event.sender)
    const [x, y] = sender ? sender.getPosition() : [100, 100]
    const bootstrapWidget = options && typeof options === 'object' ? options.transferWidget : undefined
    createWindow({ x: x + 30, y: y + 30, bootstrapWidget })
  })

  ipcMain.handle('open-dev-control-window', () => {
    createDevControlWindow()
  })

  ipcMain.handle('consume-window-bootstrap-widget', (event) => {
    const payload = pendingBootstrapByWebContentsId.get(event.sender.id)
    if (!payload) return null
    pendingBootstrapByWebContentsId.delete(event.sender.id)
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

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
