import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '../../../core/database/db'
import { applyProtocolToEnterprise } from '../../../core/services/health-scheduler'
import { useEnterpriseHealthEvents } from '../../../core/database/hooks/use-health'
import { CompleteEventSheet } from '../../health/CompleteEventSheet'
import { EVENT_TYPE_CONFIG, STATUS_CONFIG } from '../../health/health-config'
import type { EnterpriseInstance, ScheduledHealthEvent } from '../../../shared/types'

// ── Upcoming event card (horizontal scroll) ───────────────────────────────────

function UpcomingCard({
  event,
  onClick,
}: {
  event: ScheduledHealthEvent
  onClick: () => void
}) {
  const tc = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.other
  const sc = STATUS_CONFIG[event.status]
  const dayLabel = (() => {
    try { return format(new Date(event.scheduledDate), 'MMM d') }
    catch { return event.scheduledDate }
  })()

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-36 flex flex-col gap-1.5 bg-white border border-gray-100 rounded-xl p-3 active:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className={`w-2.5 h-2.5 rounded-full ${tc.dot}`} />
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${sc.chip}`}>
          {sc.label}
        </span>
      </div>
      <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{event.name}</p>
      <p className="text-xs text-gray-400">{dayLabel}</p>
    </button>
  )
}

// ── Timeline event row ────────────────────────────────────────────────────────

function TimelineRow({
  event,
  onClick,
}: {
  event: ScheduledHealthEvent
  onClick: () => void
}) {
  const tc = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.other
  const sc = STATUS_CONFIG[event.status]
  const dateLabel = (() => {
    try { return format(new Date(event.scheduledDate), 'd MMM yyyy') }
    catch { return event.scheduledDate }
  })()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 text-left active:bg-gray-50 transition-colors"
    >
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tc.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-tight truncate">{event.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {dateLabel}
          {event.product ? ` · ${event.product}` : ''}
        </p>
        {event.status === 'completed' && event.completedDate && (
          <p className="text-xs text-emerald-600 mt-0.5">
            Done {format(new Date(event.completedDate), 'd MMM')}
            {event.completedBy ? ` by ${event.completedBy}` : ''}
          </p>
        )}
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.chip}`}>
        {sc.label}
      </span>
    </button>
  )
}

// ── Apply protocol sheet ──────────────────────────────────────────────────────

function ApplyProtocolSheet({
  enterprise,
  onClose,
}: {
  enterprise: EnterpriseInstance
  onClose: () => void
}) {
  const protocols = useLiveQuery(async () => {
    const locs = await db.farmLocations.toArray()
    if (!locs.length) return []
    const orgId = locs[0]?.organizationId
    if (!orgId) return []
    return db.healthProtocols
      .where('organizationId').equals(orgId)
      .filter(p => p.enterpriseType === enterprise.enterpriseType)
      .toArray()
  }, [enterprise.enterpriseType])

  const [applying, setApplying] = useState(false)

  const handleApply = async (protocolId: string) => {
    const p = protocols?.find(x => x.id === protocolId)
    if (!p) return
    setApplying(true)
    try {
      await applyProtocolToEnterprise(enterprise.id, enterprise.startDate, p)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[60dvh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="px-4 pb-2">
          <p className="text-base font-semibold text-gray-900">Apply Health Protocol</p>
          <p className="text-xs text-gray-400 mt-0.5">Select a protocol to generate scheduled events</p>
        </div>
        <div className="h-px bg-gray-100 mx-4 mb-2" />
        <div className="px-4 pb-6 space-y-2">
          {!protocols && <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>}
          {protocols?.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No protocols for this enterprise type</p>
          )}
          {protocols?.map(p => (
            <button
              key={p.id}
              onClick={() => handleApply(p.id)}
              disabled={applying}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-left active:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.events.length} events</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({ events }: { events: ScheduledHealthEvent[] }) {
  const total     = events.length
  const completed = events.filter(e => e.status === 'completed').length
  const overdue   = events.filter(e => e.status === 'overdue').length
  const upcoming  = events.filter(e => e.status === 'upcoming' || e.status === 'due_today').length

  const stats = [
    { label: 'Total',     value: total,     color: 'text-gray-700' },
    { label: 'Done',      value: completed, color: 'text-emerald-600' },
    { label: 'Upcoming',  value: upcoming,  color: 'text-blue-600' },
    { label: 'Overdue',   value: overdue,   color: 'text-red-600' },
  ]

  return (
    <div className="flex divide-x divide-gray-100">
      {stats.map(s => (
        <div key={s.label} className="flex-1 text-center py-3">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-400">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EnterpriseHealthTab({ enterprise }: { enterprise: EnterpriseInstance }) {
  const navigate = useNavigate()
  const events   = useEnterpriseHealthEvents(enterprise.id)
  const [selected, setSelected]         = useState<ScheduledHealthEvent | null>(null)
  const [showApplySheet, setShowApply]  = useState(false)

  const upcoming14 = (events ?? []).filter(e => {
    if (e.status === 'completed' || e.status === 'skipped') return false
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 14)
    return e.scheduledDate <= cutoff.toISOString().slice(0, 10)
  })

  return (
    <div className="p-4 space-y-4">
      {/* Stats card */}
      {events && events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <StatsRow events={events} />
        </div>
      )}

      {/* Upcoming events — horizontal scroll */}
      {upcoming14.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Next 14 Days
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {upcoming14.map(e => (
              <UpcomingCard key={e.id} event={e} onClick={() => setSelected(e)} />
            ))}
          </div>
        </div>
      )}

      {/* Full timeline */}
      {events && events.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Full Timeline</p>
            <button
              onClick={() => navigate('/health')}
              className="text-xs text-primary-600 font-medium"
            >
              View all →
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 divide-y divide-gray-50">
            {events.map(e => (
              <TimelineRow key={e.id} event={e} onClick={() => setSelected(e)} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {events !== undefined && events.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-3xl mb-2">🩺</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">No health events</p>
          <p className="text-xs text-gray-400 mb-4">Apply a vaccination protocol to get started</p>
          <button
            onClick={() => setShowApply(true)}
            className="btn-primary text-sm px-4"
          >
            Apply Protocol
          </button>
        </div>
      )}

      {/* Apply protocol button (when events exist) */}
      {events !== undefined && events.length > 0 && (
        <button
          onClick={() => setShowApply(true)}
          className="w-full py-3 border border-primary-200 text-primary-600 rounded-xl text-sm font-semibold active:bg-primary-50 transition-colors"
        >
          Apply Another Protocol
        </button>
      )}

      {/* Complete event sheet */}
      {selected && (
        <CompleteEventSheet
          event={selected}
          enterpriseName={enterprise.name}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Apply protocol sheet */}
      {showApplySheet && (
        <ApplyProtocolSheet
          enterprise={enterprise}
          onClose={() => setShowApply(false)}
        />
      )}
    </div>
  )
}
