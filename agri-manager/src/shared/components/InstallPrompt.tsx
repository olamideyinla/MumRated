import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useUIStore } from '../../stores/ui-store'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-dismissed'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function shouldShow(): boolean {
  const ts = localStorage.getItem(DISMISSED_KEY)
  if (!ts) return true
  return Date.now() - parseInt(ts, 10) > SEVEN_DAYS_MS
}

export default function InstallPrompt() {
  const addToast = useUIStore(s => s.addToast)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(shouldShow)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      addToast({ message: 'AgriManagerX added to home screen!', type: 'success' })
      setDeferredPrompt(null)
      setVisible(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [addToast])

  if (!deferredPrompt || !visible) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  }

  return (
    <div className="bg-primary-500 text-white px-4 py-2 flex items-center gap-3 safe-top animate-slide-down">
      <Download className="w-4 h-4 shrink-0" />
      <p className="text-sm flex-1">Install AgriManagerX for offline access</p>
      <button
        onClick={handleInstall}
        className="text-accent font-semibold text-sm shrink-0"
        aria-label="Install app"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="touch-target shrink-0"
        aria-label="Dismiss install prompt"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
