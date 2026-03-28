import { useEffect, useRef } from 'react'
import { AppRoutes } from './routes'
import { useAuthStore } from './stores/auth-store'
import { useUIStore } from './stores/ui-store'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { ToastContainer } from './shared/components/ToastContainer'

export default function App() {
  const initialize = useAuthStore(s => s.initialize)
  const setOnline  = useUIStore(s => s.setOnline)
  const theme      = useUIStore(s => s.theme)
  const fontSize   = useUIStore(s => s.fontSize)
  const mqRef      = useRef<MediaQueryList | null>(null)

  // Initialize auth (reads Supabase session from localStorage — works offline)
  useEffect(() => { initialize() }, [initialize])

  // Track online/offline state
  useEffect(() => {
    const handleOnline  = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  // Apply dark/light class to <html> and font size
  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', dark)
    }

    applyTheme()

    // Listen to system changes only in system mode
    if (theme === 'system') {
      if (!mqRef.current) {
        mqRef.current = window.matchMedia('(prefers-color-scheme: dark)')
      }
      mqRef.current.addEventListener('change', applyTheme)
      return () => mqRef.current?.removeEventListener('change', applyTheme)
    } else {
      mqRef.current?.removeEventListener('change', applyTheme)
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('font-large', fontSize === 'large')
  }, [fontSize])

  return (
    <ErrorBoundary>
      <AppRoutes />
      <ToastContainer />
    </ErrorBoundary>
  )
}
