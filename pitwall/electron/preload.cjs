const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  f1store: {
    read: (table, sessionKey, driverNumber) =>
      ipcRenderer.invoke('f1store-read', { table, sessionKey, driverNumber }),
    write: (table, sessionKey, rows, isComplete, driverNumber) =>
      ipcRenderer.invoke('f1store-write', { table, sessionKey, rows, isComplete, driverNumber }),
    isComplete: (table, sessionKey, driverNumber) =>
      ipcRenderer.invoke('f1store-is-complete', { table, sessionKey, driverNumber }),
  },
  openNewWindow: (options) => ipcRenderer.invoke('open-new-window', options),
  dockWidgetToMainWorkspace: (payload) => ipcRenderer.invoke('dock-widget-to-main', payload),
  closeCurrentWindow: () => ipcRenderer.invoke('close-current-window'),
  openDevControlWindow: () => ipcRenderer.invoke('open-dev-control-window'),
  consumeWindowBootstrapWidget: () => ipcRenderer.invoke('consume-window-bootstrap-widget'),
  savePitwallFile: (options) => ipcRenderer.invoke('save-pitwall-file', options),
  openPitwallFile: () => ipcRenderer.invoke('open-pitwall-file'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onDebugAction: (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on('debug-action', handler)
    return () => ipcRenderer.removeListener('debug-action', handler)
  },
  onFocusChange: (cb) => {
    const handler = (_event, focused) => cb(focused)
    ipcRenderer.on('window-focus-change', handler)
    return () => ipcRenderer.removeListener('window-focus-change', handler)
  },
  onWindowBootstrapWidget: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('window-bootstrap-widget', handler)
    return () => ipcRenderer.removeListener('window-bootstrap-widget', handler)
  },
  onWindowResetPopoutState: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('window-reset-popout-state', handler)
    return () => ipcRenderer.removeListener('window-reset-popout-state', handler)
  },
  onDockWidgetIntoWorkspace: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('dock-widget-into-workspace', handler)
    return () => ipcRenderer.removeListener('dock-widget-into-workspace', handler)
  },
  onPopoutDockPreview: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('popout-dock-preview', handler)
    return () => ipcRenderer.removeListener('popout-dock-preview', handler)
  },
})
