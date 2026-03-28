import { syncEngine } from './sync-engine'

// ── Debounced push ────────────────────────────────────────────────────────────

let _pushTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced push — call after any DB write to schedule a push in 5 s. */
export function debouncedPush(): void {
  if (_pushTimer !== null) clearTimeout(_pushTimer)
  _pushTimer = setTimeout(() => {
    _pushTimer = null
    syncEngine.pushChanges().catch(console.error)
  }, 5_000)
}

/** Cancel any pending debounced push (call on sign-out). */
export function cancelDebouncedPush(): void {
  if (_pushTimer !== null) {
    clearTimeout(_pushTimer)
    _pushTimer = null
  }
}

// ── SW message listener ───────────────────────────────────────────────────────

function handleSwMessage(event: MessageEvent) {
  const type = (event.data as { type?: string } | null)?.type
  if (type === 'BG_SYNC_REQUESTED' || type === 'PERIODIC_SYNC_REQUESTED') {
    syncEngine.fullSync().catch(console.error)
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Set up all sync triggers.
 * Call from a React component with `useEffect`; return value is the cleanup fn.
 */
export function initSyncTriggers(): () => void {
  // Immediate sync on startup
  syncEngine.fullSync().catch(console.error)

  // Sync on network reconnect
  const onOnline = () => syncEngine.fullSync().catch(console.error)
  window.addEventListener('online', onOnline)

  // Sync when tab becomes visible
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      syncEngine.fullSync().catch(console.error)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  // Periodic sync every 5 min (only when visible)
  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      syncEngine.fullSync().catch(console.error)
    }
  }, 5 * 60 * 1_000)

  // Listen for background sync messages from the service worker
  const swListener = handleSwMessage
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', swListener)
  }

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibility)
    clearInterval(intervalId)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', swListener)
    }
  }
}
