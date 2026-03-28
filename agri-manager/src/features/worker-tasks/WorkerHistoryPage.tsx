import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { useAuthStore } from '../../stores/auth-store'
import {
  useWorkerTaskHistory,
  useWorkerStreak,
  useChecklistForDate,
} from '../../core/database/hooks/use-worker-tasks'
import type { TimeWindow } from '../../shared/types'

// ── Day dot ───────────────────────────────────────────────────────────────────

function DayDot({ pct, date, selected, onClick }: { pct: number; date: string; selected: boolean; onClick: () => void }) {
  const dot = !pct && pct !== 0 ? 'bg-gray-200'
    : pct === 0   ? 'bg-gray-200'
    : pct === 100 ? 'bg-emerald-500'
    : pct >= 50   ? 'bg-amber-400'
    : 'bg-red-400'

  const label = format(new Date(date + 'T00:00:00'), 'd')
  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${selected ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
    >
      <span className={`text-[11px] font-medium ${isToday ? 'text-primary-700' : 'text-gray-500'}`}>{label}</span>
      <span className={`w-5 h-5 rounded-full ${dot} ${selected ? 'ring-2 ring-offset-1 ring-primary-500' : ''}`} />
    </button>
  )
}

// ── Selected day detail ───────────────────────────────────────────────────────

const WINDOW_ICONS: Record<TimeWindow, string> = { morning: '☀️', midday: '🌤️', evening: '🌙', anytime: '📋' }

function DayDetail({ workerId, date }: { workerId: string; date: string }) {
  const cl = useChecklistForDate(workerId, date)

  if (cl === undefined) return <p className="text-center text-gray-400 text-sm py-4">Loading…</p>
  if (cl === null) return (
    <div className="text-center py-6 text-gray-400 text-sm">
      <p>No checklist for {format(new Date(date + 'T00:00:00'), 'd MMM yyyy')}</p>
    </div>
  )

  const { tasks } = cl
  const completed = tasks.filter(t => t.status === 'completed').length
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {format(new Date(date + 'T00:00:00'), 'EEEE, d MMM yyyy')}
        </p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          pct === 100 ? 'bg-emerald-100 text-emerald-700'
          : pct >= 50 ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
        }`}>
          {completed}/{tasks.length} ({pct}%)
        </span>
      </div>

      {tasks.map(t => (
        <div key={t.id} className={`flex items-start gap-2 p-2.5 rounded-xl border text-sm ${
          t.status === 'completed' ? 'bg-emerald-50 border-emerald-100'
          : t.status === 'skipped' ? 'bg-gray-50 border-gray-100 opacity-60'
          : 'bg-white border-gray-100'
        }`}>
          <span className="text-base flex-shrink-0">{WINDOW_ICONS[t.timeWindow]}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-medium leading-tight ${t.status === 'completed' ? 'text-emerald-700' : 'text-gray-700'}`}>
              {t.title}
            </p>
            {t.notes && <p className="text-xs text-gray-400 mt-0.5">{t.notes}</p>}
          </div>
          <span className="text-base flex-shrink-0">
            {t.status === 'completed' ? '✅' : t.status === 'skipped' ? '⏭' : '○'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkerHistoryPage() {
  const navigate  = useNavigate()
  const appUser   = useAuthStore(s => s.appUser)
  const workerId  = appUser?.id
  const today     = format(new Date(), 'yyyy-MM-dd')

  const history   = useWorkerTaskHistory(workerId, 30)
  const streak    = useWorkerStreak(workerId)
  const [selectedDate, setSelectedDate] = useState(today)

  // Build a map of date → summary
  const historyMap = new Map(history?.map(h => [h.date, h]) ?? [])

  // Days to show (last 30, grouped into weeks of 7)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
    return { date: d, ...(historyMap.get(d) ?? { pct: -1, hasChecklist: false }) }
  })

  // Monthly stats
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const monthDays  = history?.filter(h => h.date >= monthStart && h.date <= monthEnd && h.hasChecklist) ?? []
  const monthFull  = monthDays.filter(h => h.pct === 100).length

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1">My History</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-primary-700">🔥 {streak?.currentStreak ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Day streak</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{streak?.thisWeekCompletionPct ?? 0}%</p>
            <p className="text-xs text-gray-500 mt-0.5">This week</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-700">{streak?.totalTasksCompleted ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total done</p>
          </div>
        </div>

        {/* Monthly summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-700">{format(new Date(), 'MMMM')} Summary</p>
            <span className="text-xs text-gray-400">
              Best streak: {streak?.longestStreak ?? 0} days
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {monthFull} of {monthDays.length} days fully completed ({monthDays.length > 0 ? Math.round((monthFull / monthDays.length) * 100) : 0}%)
          </p>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"/>100%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"/>Partial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"/>Low</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-200 inline-block"/>None</span>
          </div>

          {/* Dot calendar — 5 weeks × 7 columns */}
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <span key={i} className="text-center text-[10px] text-gray-400 font-medium">{d}</span>
            ))}
            {days.map(d => (
              <DayDot
                key={d.date}
                date={d.date}
                pct={'pct' in d ? d.pct : -1}
                selected={selectedDate === d.date}
                onClick={() => setSelectedDate(d.date)}
              />
            ))}
          </div>
        </div>

        {/* Selected day detail */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {workerId && <DayDetail workerId={workerId} date={selectedDate} />}
        </div>

        <div className="h-6" />
      </div>
    </div>
  )
}
