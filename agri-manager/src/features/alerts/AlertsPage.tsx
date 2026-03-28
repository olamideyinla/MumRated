import { useAlerts } from '../../core/database/hooks/useAlerts'
import { db } from '../../core/database/db'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCheck, AlertTriangle, AlertCircle, Info, Settings, X,
} from 'lucide-react'
import { timeAgo } from '../../core/utils/date'
import type { Alert, AlertSeverity } from '../../shared/types'

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityIcon(s: AlertSeverity) {
  if (s === 'critical') return <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
  if (s === 'high')     return <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
  if (s === 'medium')   return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
}

function severityBorderColor(s: AlertSeverity) {
  if (s === 'critical') return 'border-l-red-600'
  if (s === 'high')     return 'border-l-orange-500'
  if (s === 'medium')   return 'border-l-amber-500'
  return 'border-l-blue-500'
}

function severityGroupLabel(s: AlertSeverity): string {
  if (s === 'critical') return '🔴 Critical'
  if (s === 'high')     return '🟠 High Priority'
  if (s === 'medium')   return '🟡 Medium'
  return '🔵 Info'
}

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'high', 'medium', 'info']

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const navigate = useNavigate()

  const markRead = () => {
    if (!alert.isRead) db.alerts.update(alert.id, { isRead: true })
  }

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    db.alerts.update(alert.id, { isDismissed: true })
  }

  const handleAction = () => {
    markRead()
    if (alert.actionRoute) navigate(alert.actionRoute)
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 border-l-4 shadow-sm p-3.5 ${severityBorderColor(alert.severity)} ${!alert.isRead ? 'ring-1 ring-primary-100' : ''}`}
      onClick={markRead}
    >
      <div className="flex items-start gap-2">
        {severityIcon(alert.severity)}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${!alert.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {alert.message}
          </p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo(new Date(alert.createdAt))}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 -mt-0.5 -mr-0.5">
          {!alert.isRead && (
            <span className="w-2 h-2 bg-primary-500 rounded-full" />
          )}
          <button
            onClick={dismiss}
            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 active:scale-90 transition-all rounded-lg hover:bg-gray-100"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {alert.actionRoute && alert.actionLabel && (
        <button
          onClick={handleAction}
          className="mt-2 text-xs font-semibold text-primary-600 flex items-center gap-1 active:opacity-70"
        >
          {alert.actionLabel} →
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const alerts  = useAlerts() ?? []
  const navigate = useNavigate()

  const markAllRead = async () => {
    await db.alerts.toCollection().modify({ isRead: true })
  }

  // Group by severity
  const grouped = SEVERITY_ORDER.reduce<Record<AlertSeverity, Alert[]>>(
    (acc, sev) => {
      acc[sev] = alerts.filter(a => a.severity === sev)
      return acc
    },
    { critical: [], high: [], medium: [], info: [] },
  )

  const hasUnread = alerts.some(a => !a.isRead)

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 safe-top">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Alerts</h1>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-sm text-primary-600 font-medium mr-1"
          >
            <CheckCheck className="w-4 h-4" />
            All read
          </button>
        )}
        <button
          onClick={() => navigate('/alerts/settings')}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-700 active:scale-90 transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 fade-in">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-semibold text-gray-700">No active alerts</p>
            <p className="text-xs text-gray-400 mt-1">Your farm is running smoothly</p>
          </div>
        ) : (
          SEVERITY_ORDER.map(sev => {
            const group = grouped[sev]
            if (group.length === 0) return null
            return (
              <div key={sev}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {severityGroupLabel(sev)} ({group.length})
                </p>
                <div className="space-y-2">
                  {group.map(alert => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
