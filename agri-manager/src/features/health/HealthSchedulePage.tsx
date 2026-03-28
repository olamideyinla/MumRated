import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import { deriveEventStatus } from '../../core/services/health-scheduler'
import { CompleteEventSheet } from './CompleteEventSheet'
import { EVENT_TYPE_CONFIG, STATUS_CONFIG } from './health-config'
import type { ScheduledHealthEvent, HealthEventStatus } from '../../shared/types'

// ── Filter options ────────────────────────────────────────────────────────────

const FILTERS: { id: HealthEventStatus | 'all'; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'due_today', label: 'Due Today' },
  { id: 'overdue',   label: 'Overdue' },
  { id: 'upcoming',  label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

// ── Live data hook ────────────────────────────────────────────────────────────

interface EventWithMeta extends ScheduledHealthEvent {
  enterpriseName: string
}

function useScheduleData(userId: string | undefined) {
  return useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null

    const locations = await db.farmLocations
      .where('organizationId').equals(user.organizationId).toArray()
    const locationIds = new Set(locations.map(l => l.id))
    const infras = await db.infrastructures.toArray()
    const orgInfraIds = new Set(infras.filter(i => locationIds.has(i.farmLocationId)).map(i => i.id))
    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf([...orgInfraIds])
      .filter(e => e.status === 'active')
      .toArray()
    const enterpriseMap = new Map(enterprises.map(e => [e.id, e.name]))
    const enterpriseIds = [...enterpriseMap.keys()]

    if (enterpriseIds.length === 0) return { events: [], enterprises: [] }

    const allEvents = await db.scheduledHealthEvents
      .where('enterpriseInstanceId').anyOf(enterpriseIds)
      .toArray()

    const events: EventWithMeta[] = allEvents
      .map(e => ({
        ...e,
        status: deriveEventStatus(e.scheduledDate, e.status),
        enterpriseName: enterpriseMap.get(e.enterpriseInstanceId) ?? 'Unknown',
      }))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))

    return { events, enterprises }
  }, [userId])
}

// ── Date group label ──────────────────────────────────────────────────────────

function groupLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const today = new Date(); today.setHours(0,0,0,0)
    const diff = Math.round((d.setHours(0,0,0,0) - today.getTime()) / 86_400_000)
    if (diff === 0)  return 'Today'
    if (diff === -1) return 'Yesterday'
    if (diff === 1)  return 'Tomorrow'
    if (diff < 0)    return `${Math.abs(diff)} days ago · ${format(new Date(dateStr), 'd MMM')}`
    return format(new Date(dateStr), 'EEE, d MMM yyyy')
  } catch {
    return dateStr
  }
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({
  event,
  onClick,
}: {
  event: EventWithMeta
  onClick: () => void
}) {
  const tc = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.other
  const sc = STATUS_CONFIG[event.status]

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 text-left active:bg-gray-50 transition-colors"
    >
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tc.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-tight truncate">{event.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {event.enterpriseName}
          {event.product ? ` · ${event.product}` : ''}
        </p>
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.chip}`}>
        {sc.label}
      </span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HealthSchedulePage() {
  const navigate  = useNavigate()
  const userId    = useAuthStore(s => s.user?.id)
  const [filter, setFilter]         = useState<HealthEventStatus | 'all'>('all')
  const [selected, setSelected]     = useState<EventWithMeta | null>(null)

  const data = useScheduleData(userId)

  const filtered = (data?.events ?? []).filter(e =>
    filter === 'all' || e.status === filter,
  )

  // Group by date
  const groups: Map<string, EventWithMeta[]> = new Map()
  for (const e of filtered) {
    const g = groups.get(e.scheduledDate) ?? []
    g.push(e)
    groups.set(e.scheduledDate, g)
  }

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1">Health Schedule</h1>
          <button
            onClick={() => navigate('/health/protocols')}
            className="text-white/80 text-xs font-medium px-2 py-1 rounded-lg hover:text-white"
          >
            Protocols
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                filter === f.id
                  ? 'bg-white text-primary-700'
                  : 'bg-primary-500/40 text-white hover:bg-primary-500/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {data === undefined && (
          <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
        )}

        {data !== undefined && filtered.length === 0 && (
          <div className="text-center mt-16 px-8">
            <p className="text-3xl mb-3">🩺</p>
            <p className="text-sm font-semibold text-gray-700">No health events</p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === 'all'
                ? 'Events are auto-generated when you create enterprises'
                : `No ${filter.replace('_', ' ')} events`}
            </p>
          </div>
        )}

        {[...groups.entries()].map(([date, events]) => (
          <div key={date} className="bg-white mx-4 mt-3 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {groupLabel(date)}
              </p>
            </div>
            <div className="px-4 divide-y divide-gray-50">
              {events.map(e => (
                <EventRow
                  key={e.id}
                  event={e}
                  onClick={() => setSelected(e)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="h-24" />
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/health/protocols')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-primary-700 transition-colors z-30"
      >
        <Plus size={24} />
      </button>

      {/* Bottom sheet */}
      {selected && (
        <CompleteEventSheet
          event={selected}
          enterpriseName={selected.enterpriseName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
