import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'react-grid-layout/css/styles.css'
import './index.css'
import { AppErrorBoundary } from './components/ErrorBoundary/AppErrorBoundary'
import { initLogBridge } from './store/logStore'
import { initElectronDebugBridge } from './lib/electronDebugBridge'

initLogBridge()
initElectronDebugBridge()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

async function resolveRootComponent() {
  const kind = new URLSearchParams(window.location.search).get('windowKind')
  if (kind === 'widget-popout') return (await import('./PopoutApp.tsx')).default
  if (kind === 'driver-manager') return (await import('./DriverManagerApp.tsx')).default
  if (kind === 'widget-settings') return (await import('./WidgetSettingsApp.tsx')).default
  return (await import('./App.tsx')).default
}

void resolveRootComponent().then((RootComponent) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootComponent />
        </QueryClientProvider>
      </AppErrorBoundary>
    </StrictMode>,
  )
})
