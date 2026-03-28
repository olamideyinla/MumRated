import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useEnterpriseHealthEvents } from '../../core/database/hooks/use-health'

interface Props {
  enterpriseInstanceId: string | undefined
}

export function HealthEventBanner({ enterpriseInstanceId }: Props) {
  const navigate = useNavigate()
  const events   = useEnterpriseHealthEvents(enterpriseInstanceId)

  const dueCount = (events ?? []).filter(
    e => e.status === 'due_today' || e.status === 'overdue',
  ).length

  if (!dueCount) return null

  return (
    <button
      onClick={() => navigate('/health')}
      className="w-full flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-left active:bg-amber-100 transition-colors"
    >
      <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
      <p className="flex-1 text-xs font-medium text-amber-800">
        {dueCount} health event{dueCount !== 1 ? 's' : ''} due today — View Schedule
      </p>
      <span className="text-amber-500 text-xs">→</span>
    </button>
  )
}
