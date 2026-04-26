interface ElectronAPI {
  platform: string
  openNewWindow: (options?: {
    transferWidget?: unknown
    windowKind?: 'widget-popout'
    popoutBounds?: {
      x?: number
      y?: number
      width?: number
      height?: number
    }
  }) => Promise<void>
  dockWidgetToMainWorkspace: (payload: unknown) => Promise<boolean>
  closeCurrentWindow: () => Promise<void>
  openDevControlWindow: () => Promise<void>
  consumeWindowBootstrapWidget: () => Promise<unknown | null>
  savePitwallFile: (options: { defaultName: string; contents: string }) => Promise<{ canceled: boolean; filePath?: string }>
  openPitwallFile: () => Promise<{ canceled: boolean; filePath?: string; contents?: string }>
  openExternal: (url: string) => Promise<void>
  onDebugAction: (cb: (message: { action: string; payload?: unknown }) => void) => () => void
  onFocusChange: (cb: (focused: boolean) => void) => () => void
  onWindowBootstrapWidget: (cb: (payload: unknown) => void) => () => void
  onWindowResetPopoutState: (cb: () => void) => () => void
  onDockWidgetIntoWorkspace: (cb: (payload: unknown) => void) => () => void
  onPopoutDockPreview: (cb: (payload: unknown) => void) => () => void
}

interface DevToolsAPI {
  triggerAction: (action: string, payload?: unknown) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    devToolsAPI?: DevToolsAPI
  }
}

export {}
