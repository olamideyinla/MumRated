import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import { format, startOfWeek, addDays } from 'date-fns'
import { useAuthStore } from '../../stores/auth-store'
import {
  useTeamDailyStatus,
  useWorkerWeeklyGrid,
  useChecklistForDate,
  type TeamMemberStatus,
} from '../../core/database/hooks/use-worker-tasks'
import { db } from '../../core/database/db'
import { useLiveQuery } from 'dexie-react-hooks'

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── WhatsApp nudge builder ─────────────────────────────────────────────────────

async function buildWhatsAppNudge(
  workerId: string,
  workerName: string,
  date: string,
  orgId: string,
): Promise<string> {
  const org     = await db.organizations.where('id').equals(orgId).first()
  const farmName = org?.name ?? 'the farm'

  const checklist = await db.dailyTaskChecklists
    .where('[workerId+date]').equals([workerId, date])
    .first()
  if (!checklist) return `Hi ${workerName}, please complete your tasks for today. — ${farmName}`

  const tasks = await db.dailyTasks
    .where('checklistId').equals(checklist.id)
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .toArray()
  const taskList = tasks.slice(0, 5).map(t => `• ${t.title}`).join('\n')
  const more = tasks.length > 5 ? `\n• ...and ${tasks.length - 5} more` : ''
  return `Hi ${workerName}, you have ${tasks.length} task${tasks.length !== 1 ? 's' : ''} remaining today:\n${taskList}${more}\n\nPlease complete them when you can. — ${farmName}`
}

// ── Worker row (expandable) ───────────────────────────────────────────────────

function WorkerRow({
  status,
  date,
  orgId,
}: {
  status: TeamMemberStatus
  date: string
  orgId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const clData = useChecklistForDate(expanded ? status.workerId : undefined, date)

  const worker = useLiveQuery(async () => {
    return db.appUsers.get(status.workerId)
  }, [status.workerId])

  const handleWhatsApp = async () => {
    const msg = await buildWhatsAppNudge(status.workerId, status.workerName, date, orgId)
    const phone = worker?.phone?.replace(/\D/g, '') ?? ''
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
      >
        <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-primary-700 font-bold text-sm">{status.workerName.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{status.workerName}</p>
            <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${
              status.pct >= 80 ? 'text-emerald-600' : status.pct >= 50 ? 'text-amber-600' : 'text-red-500'
            }`}>
              {status.completed}/{status.total}
            </span>
          </div>
          <ProgressBar pct={status.pct} />
          {status.overdue > 0 && (
            <p className="text-xs text-red-500 mt-0.5">{status.overdue} overdue</p>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {clData === undefined && <p className="text-xs text-gray-400">Loading…</p>}
          {clData === null && <p className="text-xs text-gray-400">No checklist for today</p>}
          {clData?.tasks.map(t => (
            <div key={t.id} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
              t.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
              : t.status === 'skipped' ? 'bg-gray-50 text-gray-400'
              : 'bg-red-50 text-red-700'
            }`}>
              <span>{t.status === 'completed' ? '✅' : t.status === 'skipped' ? '⏭' : '○'}</span>
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-[10px] uppercase opacity-70">{t.priority}</span>
            </div>
          ))}

          {/* WhatsApp reminder button */}
          {status.completed < status.total && worker?.phone && (
            <button
              onClick={() => void handleWhatsApp()}
              className="w-full flex items-center justify-center gap-2 mt-1 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 active:bg-green-200 transition-colors"
            >
              <MessageCircle size={14} />
              Send WhatsApp Reminder
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Weekly grid tab ───────────────────────────────────────────────────────────

function WeeklyGridTab({ orgId }: { orgId: string }) {
  const today     = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const wFrom     = format(weekStart, 'yyyy-MM-dd')
  const wTo       = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const grid      = useWorkerWeeklyGrid(orgId, wFrom, wTo)

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const cellColor = (pct: number) => {
    if (pct === -1) return 'bg-gray-100 text-gray-400'
    if (pct === 100) return 'bg-emerald-500 text-white'
    if (pct >= 50)   return 'bg-amber-400 text-white'
    return 'bg-red-400 text-white'
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[360px]">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-gray-500 font-medium w-24">Worker</th>
              {dayLabels.map(d => (
                <th key={d} className="px-1 py-2 text-center text-gray-500 font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid?.map(row => (
              <tr key={row.workerId}>
                <td className="px-2 py-1.5 font-medium text-gray-700 truncate max-w-[96px]">
                  {row.workerName.split(' ')[0]}
                </td>
                {row.cells.map(cell => (
                  <td key={cell.date} className="px-1 py-1.5 text-center">
                    <span className={`inline-block w-9 h-6 rounded-lg text-[10px] font-bold leading-6 ${cellColor(cell.pct)}`}>
                      {cell.pct === -1 ? '—' : `${cell.pct}%`}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grid && grid.length > 0 && (() => {
        const best = grid.reduce((a, b) => {
          const aAvg = b.cells.filter(c => c.pct >= 0).reduce((s, c) => s + c.pct, 0) / Math.max(1, b.cells.filter(c => c.pct >= 0).length)
          const bAvg = a.cells.filter(c => c.pct >= 0).reduce((s, c) => s + c.pct, 0) / Math.max(1, a.cells.filter(c => c.pct >= 0).length)
          return aAvg > bAvg ? b : a
        })
        const bestAvg = best.cells.filter(c => c.pct >= 0).reduce((s, c) => s + c.pct, 0) / Math.max(1, best.cells.filter(c => c.pct >= 0).length)
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-700">⭐ Worker of the Week</p>
            <p className="text-sm text-amber-600 mt-0.5">{best.workerName} — {Math.round(bestAvg)}% avg completion</p>
          </div>
        )
      })()}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SupervisorTaskDashboard() {
  const navigate = useNavigate()
  const appUser  = useAuthStore(s => s.appUser)
  const orgId    = appUser?.organizationId
  const today    = format(new Date(), 'yyyy-MM-dd')
  const [tab, setTab] = useState<'today' | 'weekly'>('today')

  const teamStatus = useTeamDailyStatus(orgId, today)

  const overallPct = teamStatus && teamStatus.length > 0
    ? Math.round(teamStatus.reduce((s, w) => s + w.pct, 0) / teamStatus.length)
    : 0

  const completedWorkers = teamStatus?.filter(w => w.pct === 100).length ?? 0

  if (!orgId) return null

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1">Team Tasks</h1>
        </div>
        <p className="text-white/70 text-xs mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white border-b border-gray-100">
        {(['today', 'weekly'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors capitalize ${
              tab === t ? 'text-primary-700 border-b-2 border-primary-600' : 'text-gray-500'
            }`}
          >
            {t === 'today' ? "Today's Status" : 'Weekly Overview'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'today' && (
          <div className="px-4 py-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-primary-700">{overallPct}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Team avg</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-emerald-600">{completedWorkers}</p>
                <p className="text-xs text-gray-500 mt-0.5">All done</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-gray-700">{teamStatus?.length ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Workers</p>
              </div>
            </div>

            {/* Worker rows */}
            {teamStatus === undefined && (
              <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
            )}
            {teamStatus !== undefined && teamStatus.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                <p className="text-3xl mb-3">👷</p>
                <p className="font-semibold text-gray-700">No workers found</p>
                <p className="text-xs mt-1">Add workers in the Labor module</p>
              </div>
            )}
            {teamStatus && teamStatus.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {teamStatus.map(s => (
                  <WorkerRow key={s.workerId} status={s} date={today} orgId={orgId} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'weekly' && (
          <div className="px-4 py-4">
            <WeeklyGridTab orgId={orgId} />
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
