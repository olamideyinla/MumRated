import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import type { EnterpriseInstance } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Colour helpers ────────────────────────────────────────────────────────────

function enterpriseColor(ent: EnterpriseInstance, conflict: boolean) {
  if (conflict) return { bar: 'bg-red-400', text: 'text-white', border: 'border-red-500' }
  switch (ent.status) {
    case 'active':    return { bar: 'bg-primary-500', text: 'text-white', border: 'border-primary-600' }
    case 'planned':   return { bar: 'bg-blue-400',    text: 'text-white', border: 'border-blue-500' }
    case 'completed': return { bar: 'bg-gray-400',    text: 'text-white', border: 'border-gray-500' }
    default:          return { bar: 'bg-gray-300',    text: 'text-gray-700', border: 'border-gray-400' }
  }
}

function enterpriseEmoji(type: EnterpriseInstance['enterpriseType']): string {
  const map: Record<string, string> = {
    layers: '🥚', broilers: '🐔', cattle_dairy: '🐄', cattle_beef: '🐂',
    pigs_breeding: '🐷', pigs_growfinish: '🥩', fish: '🐟',
    crop_annual: '🌾', crop_perennial: '🌳', rabbit: '🐇', custom_animal: '🐾',
  }
  return map[type] ?? '🏢'
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function addMonths(year: number, month: number, delta: number): [number, number] {
  const d = new Date(year, month + delta, 1)
  return [d.getFullYear(), d.getMonth()]
}

// ── Data loading ──────────────────────────────────────────────────────────────

function useCalendarData() {
  const appUser = useAuthStore(s => s.appUser)
  return useLiveQuery(async () => {
    if (!appUser) return null
    const locs   = await db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray()
    const infras = await db.infrastructures.where('farmLocationId').anyOf(locs.map(l => l.id)).toArray()
    const infraIds = infras.map(i => i.id)
    if (!infraIds.length) return { enterprises: [], financials: [], infraMap: new Map<string, string>() }

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => e.status !== 'cancelled')
      .toArray()

    const financials = await db.financialTransactions
      .where('organizationId').equals(appUser.organizationId)
      .toArray()

    // Map: enterpriseId → infrastructureId (for conflict detection)
    const infraMap = new Map<string, string>(enterprises.map(e => [e.id, e.infrastructureId]))

    return { enterprises, financials, infraMap }
  }, [appUser?.organizationId])
}

// ── Conflict detection ─────────────────────────────────────────────────────────

function getConflictingIds(enterprises: EnterpriseInstance[]): Set<string> {
  const conflicting = new Set<string>()
  // Group by infrastructureId
  const byInfra = new Map<string, EnterpriseInstance[]>()
  for (const e of enterprises) {
    const list = byInfra.get(e.infrastructureId) ?? []
    list.push(e)
    byInfra.set(e.infrastructureId, list)
  }
  for (const [, group] of byInfra) {
    if (group.length < 2) continue
    // Check each pair for date overlap
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j]
        const aEnd = a.actualEndDate ?? a.expectedEndDate ?? '9999-12-31'
        const bEnd = b.actualEndDate ?? b.expectedEndDate ?? '9999-12-31'
        if (a.startDate <= bEnd && b.startDate <= aEnd) {
          conflicting.add(a.id)
          conflicting.add(b.id)
        }
      }
    }
  }
  return conflicting
}

// ── Day cell detail modal ─────────────────────────────────────────────────────

interface DayDetail {
  date: string
  enterprises: (EnterpriseInstance & { conflict: boolean })[]
  financialCount: number
}

function DayDetailSheet({ detail, onClose }: { detail: DayDetail; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-4 pb-safe-bottom shadow-xl max-h-[70dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900">{detail.date}</p>
          <button onClick={onClose} className="text-gray-400 text-sm">Close</button>
        </div>

        {detail.enterprises.length === 0 && detail.financialCount === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">No events on this day.</p>
        )}

        {detail.enterprises.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Batches active</p>
            <div className="space-y-2">
              {detail.enterprises.map(e => {
                const col = enterpriseColor(e, e.conflict)
                return (
                  <button
                    key={e.id}
                    onClick={() => { onClose(); navigate(`/enterprises/${e.id}`) }}
                    className={`w-full flex items-center gap-2 rounded-xl p-2.5 border ${col.border} bg-white text-left active:scale-[0.98] transition-transform`}
                  >
                    <span className="text-lg">{enterpriseEmoji(e.enterpriseType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{e.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {e.startDate} → {e.actualEndDate ?? e.expectedEndDate ?? 'ongoing'}
                        {e.conflict && <span className="text-red-500 font-semibold ml-1">⚠ Conflict</span>}
                      </p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${col.bar} ${col.text}`}>
                      {e.status}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {detail.financialCount > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Financial</p>
            <p className="text-sm text-gray-600">{detail.financialCount} transaction{detail.financialCount !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Enterprise legend bar ─────────────────────────────────────────────────────

function EnterpriseLegend({ enterprises, conflictIds }: {
  enterprises: EnterpriseInstance[]
  conflictIds: Set<string>
}) {
  const navigate = useNavigate()
  const visible = enterprises.slice(0, 6)
  return (
    <div className="card p-3 space-y-1.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Batches</p>
      {visible.map(e => {
        const col = enterpriseColor(e, conflictIds.has(e.id))
        return (
          <button
            key={e.id}
            onClick={() => navigate(`/enterprises/${e.id}`)}
            className="w-full flex items-center gap-2 text-left active:scale-[0.98] transition-transform"
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.bar}`} />
            <span className="text-xs text-gray-700 flex-1 truncate">{enterpriseEmoji(e.enterpriseType)} {e.name}</span>
            <span className="text-[10px] text-gray-400">{e.status}</span>
          </button>
        )
      })}
      {enterprises.length > 6 && (
        <p className="text-[10px] text-gray-400">+{enterprises.length - 6} more</p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanningCalendar() {
  const navigate = useNavigate()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null)

  const calData = useCalendarData()

  // Pre-compute conflict set
  const conflictIds = useMemo(
    () => getConflictingIds(calData?.enterprises ?? []),
    [calData?.enterprises],
  )

  // Build a map: date → list of enterprise IDs active on that date
  const activeDayMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of calData?.enterprises ?? []) {
      const start = e.startDate
      const end   = e.actualEndDate ?? e.expectedEndDate ?? '9999-12-31'
      // Iterate over days in the current view month only (performance)
      const days = daysInMonth(year, month)
      for (let d = 1; d <= days; d++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (dayStr >= start && dayStr <= end) {
          const list = map.get(dayStr) ?? []
          list.push(e.id)
          map.set(dayStr, list)
        }
      }
    }
    return map
  }, [calData?.enterprises, year, month])

  // Financial event dates
  const financialDayMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of calData?.financials ?? []) {
      const count = (map.get(f.date) ?? 0) + 1
      map.set(f.date, count)
    }
    return map
  }, [calData?.financials])

  // Calendar grid
  const totalDays = daysInMonth(year, month)
  const startDow  = firstDayOfWeek(year, month)
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null)

  function handlePrev() {
    const [ny, nm] = addMonths(year, month, -1)
    setYear(ny); setMonth(nm)
  }
  function handleNext() {
    const [ny, nm] = addMonths(year, month, 1)
    setYear(ny); setMonth(nm)
  }
  function handleToday() {
    setYear(today.getFullYear()); setMonth(today.getMonth())
  }

  function handleDayTap(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const entIds  = activeDayMap.get(dateStr) ?? []
    const ents = entIds
      .map(id => calData?.enterprises.find(e => e.id === id))
      .filter((e): e is EnterpriseInstance => !!e)
      .map(e => ({ ...e, conflict: conflictIds.has(e.id) }))
    const financialCount = financialDayMap.get(dateStr) ?? 0
    setSelectedDay({ date: dateStr, enterprises: ents, financialCount })
  }

  const todayStr = ymd(today)

  if (calData === undefined) {
    return <div className="flex h-dvh items-center justify-center text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Farm Calendar</h1>
          <button
            onClick={handleToday}
            className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg"
          >
            Today
          </button>
        </div>
      </div>

      <div className="px-3 py-4 space-y-4">
        {/* Month navigator */}
        <div className="flex items-center justify-between px-1">
          <button onClick={handlePrev} className="touch-target">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <p className="text-base font-bold text-gray-900">
            {MONTH_NAMES[month]} {year}
          </p>
          <button onClick={handleNext} className="touch-target">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="card overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-1.5 text-center text-[10px] font-semibold text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-14 border-b border-r border-gray-50 last:border-r-0" />
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const entIds  = activeDayMap.get(dateStr) ?? []
              const hasFinancial = financialDayMap.has(dateStr)
              const isToday = dateStr === todayStr
              const hasConflict = entIds.some(id => conflictIds.has(id))

              // Pick colours for the dot stack (up to 3 visible)
              const dotColors = entIds.slice(0, 3).map(id => {
                const ent = calData?.enterprises.find(e => e.id === id)
                if (!ent) return 'bg-gray-300'
                return conflictIds.has(id) ? 'bg-red-400' :
                  ent.status === 'active' ? 'bg-primary-500' :
                  ent.status === 'planned' ? 'bg-blue-400' : 'bg-gray-400'
              })

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayTap(day)}
                  className={`h-14 flex flex-col items-center pt-1.5 pb-1 border-b border-r border-gray-50
                    last:border-r-0 active:bg-gray-100 transition-colors relative
                    ${isToday ? 'bg-primary-50' : ''}
                    ${hasConflict ? 'bg-red-50' : ''}
                  `}
                >
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-primary-600 text-white' : 'text-gray-700'}`}>
                    {day}
                  </span>

                  {/* Enterprise dots */}
                  {dotColors.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dotColors.map((c, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${c}`} />
                      ))}
                      {entIds.length > 3 && (
                        <span className="text-[8px] text-gray-400">+{entIds.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Financial dot */}
                  {hasFinancial && (
                    <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-amber-400" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="card p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Legend</p>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600">
            {[
              { color: 'bg-primary-500', label: 'Active batch' },
              { color: 'bg-blue-400',    label: 'Planned batch' },
              { color: 'bg-gray-400',    label: 'Completed' },
              { color: 'bg-red-400',     label: 'Infra conflict' },
              { color: 'bg-amber-400',   label: 'Financial event' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise list */}
        {(calData?.enterprises.length ?? 0) > 0 ? (
          <EnterpriseLegend enterprises={calData!.enterprises} conflictIds={conflictIds} />
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">No batches found.</p>
            <p className="text-gray-300 text-xs mt-1">Add an enterprise to see it on the calendar.</p>
          </div>
        )}

        {/* Conflict warning */}
        {conflictIds.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Infrastructure Conflicts</p>
              <p className="text-xs text-red-600 mt-0.5">
                {conflictIds.size / 2 >= 1 ? Math.ceil(conflictIds.size / 2) : conflictIds.size} pair(s) of overlapping batches share the same infrastructure.
                Tap a red date to see details.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Day detail bottom sheet */}
      {selectedDay && (
        <DayDetailSheet detail={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
