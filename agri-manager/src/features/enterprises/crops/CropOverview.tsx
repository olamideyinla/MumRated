import { useCropMetrics } from '../hooks/use-crop-metrics'
import type { EnterpriseInstance, CropActivityType } from '../../../shared/types'

interface Props { enterprise: EnterpriseInstance }

const ACTIVITY_ICONS: Record<CropActivityType, string> = {
  planting: '🌱', fertilizing: '🌿', spraying: '💧', weeding: '🪴',
  irrigating: '🚿', harvesting: '🌾', scouting: '🔍', other: '📋',
}

// ── Growth stage timeline ─────────────────────────────────────────────────────

const STAGES = ['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvest']

function GrowthTimeline({ currentStage }: { currentStage: string | null }) {
  const lc = (currentStage ?? '').toLowerCase()
  const idx = STAGES.findIndex(s => s.toLowerCase() === lc)

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {STAGES.map((stage, i) => {
        const isActive = i === idx
        const isDone   = idx >= 0 && i < idx
        return (
          <div key={stage} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isActive ? 'bg-primary-600 border-primary-600 text-white' :
                  isDone   ? 'bg-emerald-500 border-emerald-500 text-white' :
                             'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <p className={`text-xs mt-1 text-center leading-tight w-14 ${
                isActive ? 'text-primary-700 font-semibold' : isDone ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {stage}
              </p>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 w-6 mb-4 flex-shrink-0 ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ date, activityType, notes }: { date: string; activityType: CropActivityType; notes?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xl flex-shrink-0">{ACTIVITY_ICONS[activityType]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 capitalize">
          {activityType.replace('_', ' ')}
        </p>
        {notes && <p className="text-xs text-gray-400 truncate">{notes}</p>}
      </div>
      <p className="text-xs text-gray-400 flex-shrink-0">{date}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CropOverview({ enterprise }: Props) {
  const metrics = useCropMetrics(enterprise.id, enterprise.startDate)

  if (metrics === undefined) {
    return <div className="p-4 text-sm text-gray-400">Loading…</div>
  }

  return (
    <div className="space-y-4 p-4">
      {/* Growth stage timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">Growth Stage</p>
          <p className="text-xs text-gray-400">Day {metrics.daysSincePlanting}</p>
        </div>
        <GrowthTimeline currentStage={metrics.latestGrowthStage} />
        {metrics.latestGrowthStage && (
          <p className="text-xs text-gray-500 mt-2">
            Current: <span className="font-semibold text-gray-700">{metrics.latestGrowthStage}</span>
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Season Summary</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Days', value: String(metrics.daysSincePlanting), color: 'text-gray-800' },
            { label: 'Harvest (kg)', value: metrics.totalHarvestKg > 0 ? metrics.totalHarvestKg.toLocaleString() : '—', color: 'text-emerald-600' },
            { label: 'Labour hrs', value: metrics.totalLaborHours > 0 ? String(metrics.totalLaborHours) : '—', color: 'text-gray-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Recent Activities</p>
        {metrics.recentActivities.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No activities recorded yet</p>
        ) : (
          metrics.recentActivities.map(r => (
            <ActivityRow key={r.id} date={r.date} activityType={r.activityType} notes={r.notes} />
          ))
        )}
      </div>
    </div>
  )
}
