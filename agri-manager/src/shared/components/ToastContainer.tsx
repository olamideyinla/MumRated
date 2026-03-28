import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useUIStore } from '../../stores/ui-store'

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const COLORS = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-gray-800 text-white',
}

function Toast({ id, message, type }: { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }) {
  const removeToast = useUIStore(s => s.removeToast)
  const Icon = ICONS[type]

  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), 3500)
    return () => clearTimeout(timer)
  }, [id, removeToast])

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${COLORS[type]} animate-count-up`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={() => removeToast(id)} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-24 left-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} />
        </div>
      ))}
    </div>
  )
}
