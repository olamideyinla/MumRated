import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './styles/index.css'
import App from './App'
import { env } from './core/config/env'

// ── Sentry error tracking ─────────────────────────────────────────────────────
// Only initialised when a DSN is provided (production/staging only)

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.environment,
    release: `agri-manager@${env.appVersion}`,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Sample 10% of traces in production to control costs
    tracesSampleRate: env.isProduction ? 0.1 : 0,
    // Capture 100% of sessions that encounter errors
    replaysOnErrorSampleRate: 1.0,
    // Strip auth headers before sending events
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
      }
      return event
    },
  })
}

// ── React Query ───────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status
        if (status != null && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration is best-effort; app works without it
    })
  })
}

// ── Render ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
