import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { useWizardStore } from '../wizard-store'
import { ENTERPRISE_LABELS } from '../wizard-data'

function goAndReset(navigate: ReturnType<typeof useNavigate>, to: string) {
  useWizardStore.getState().reset()
  navigate(to, { replace: true })
}

export function Step5Complete() {
  const navigate = useNavigate()
  const { infrastructures, stockEntries } = useWizardStore()

  // Build summary counts
  const typeCounts: Record<string, number> = {}
  for (const infra of infrastructures) {
    const label = ENTERPRISE_LABELS[infra.enterpriseType]
    typeCounts[label] = (typeCounts[label] ?? 0) + 1
  }
  const activeCount = stockEntries.filter(e => e.isActive).length

  const summaryParts = Object.entries(typeCounts).map(
    ([label, count]) => `${count} ${label.toLowerCase()}`
  )

  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      {/* Success icon */}
      <div className="bg-emerald-50 rounded-full p-5 mb-5">
        <CheckCircle size={56} className="text-emerald-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">You're All Set!</h2>

      {/* Summary */}
      {summaryParts.length > 0 ? (
        <p className="text-gray-600 text-sm max-w-xs mb-1">
          You've set up {summaryParts.join(', ')}
          {activeCount > 0 && ` with ${activeCount} active batch${activeCount !== 1 ? 'es' : ''}`}.
        </p>
      ) : (
        <p className="text-gray-600 text-sm max-w-xs mb-1">
          Your farm profile is ready.
        </p>
      )}

      <p className="text-xs text-gray-400 mb-8">
        Your data is saved on this device and will sync when you're online.
      </p>

      {/* Actions */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={() => goAndReset(navigate, '/daily-entry')}
          className="btn-primary w-full py-4 text-base"
        >
          Enter Today's Data →
        </button>
        <button
          onClick={() => goAndReset(navigate, '/dashboard')}
          className="btn-secondary w-full"
        >
          Explore Dashboard
        </button>
      </div>
    </div>
  )
}
