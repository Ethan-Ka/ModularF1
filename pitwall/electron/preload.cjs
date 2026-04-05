const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openNewWindow: (options) => ipcRenderer.invoke('open-new-window', options),
  openDevControlWindow: () => ipcRenderer.invoke('open-dev-control-window'),
  consumeWindowBootstrapWidget: () => ipcRenderer.invoke('consume-window-bootstrap-widget'),
  savePitwallFile: (options) => ipcRenderer.invoke('save-pitwall-file', options),
  openPitwallFile: () => ipcRenderer.invoke('open-pitwall-file'),
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
})
