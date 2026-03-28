import { useEffect, useRef } from 'react'
import { WifiOff } from 'lucide-react'
import { useUIStore } from '../../stores/ui-store'

export function OfflineBanner() {
  const isOnline  = useUIStore(s => s.isOnline)
  const addToast  = useUIStore(s => s.addToast)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      addToast({ message: 'Back online', type: 'success' })
    }
  }, [isOnline, addToast])

  if (isOnline) return null

  return (
    <div
      className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2 animate-slide-down"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium flex-1">
        You're offline — changes saved locally
      </span>
    </div>
  )
}
