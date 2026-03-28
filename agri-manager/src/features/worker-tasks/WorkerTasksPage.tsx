import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { useTodayChecklist, useWorkerStreak } from '../../core/database/hooks/use-worker-tasks'
import { generateDailyChecklist, recalculateChecklistCompletion } from '../../core/services/checklist-generator'
import { initReminderScheduler, loadReminderConfig } from '../../core/services/worker-reminder-engine'
import { db } from '../../core/database/db'
import { nowIso } from '../../shared/types/base'
import { TaskCompletionSheet } from './TaskCompletionSheet'
import type { DailyTask, TimeWindow } from '../../shared/types'

// ── Confetti burst (CSS-only, lightweight) ────────────────────────────────────

function ConfettiBurst() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-ping"
          style={{
            backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6'][i % 5],
            top: `${30 + Math.sin(i * 30) * 25}%`,
            left: `${40 + Math.cos(i * 30) * 30}%`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </div>
  )
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r  = (size - 8) / 2
  const c  = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="white" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

// ── Time window config ────────────────────────────────────────────────────────

const WINDOW_CONFIG: Record<TimeWindow, { icon: string; label: string; color: string }> = {
  morning: { icon: '☀️', label: 'Morning Tasks', color: 'text-amber-700' },
  midday:  { icon: '🌤️', label: 'Midday Tasks',  color: 'text-blue-700' },
  evening: { icon: '🌙', label: 'Evening Tasks', color: 'text-indigo-700' },
  anytime: { icon: '📋', label: 'Anytime',        color: 'text-gray-700' },
}

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'required')    return <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex-shrink-0">REQUIRED</span>
  if (priority === 'recommended') return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full flex-shrink-0">RECOMMENDED</span>
  return <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full flex-shrink-0">OPTIONAL</span>
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status, overdue }: { status: string; overdue: boolean }) {
  if (status === 'completed')  return <span className="text-xl flex-shrink-0">✅</span>
  if (status === 'skipped')    return <span className="text-xl flex-shrink-0 opacity-40">⏭</span>
  if (status === 'in_progress') return <span className="text-xl flex-shrink-0">◐</span>
  if (overdue)                 return <span className="text-xl flex-shrink-0">🔴</span>
  return <span className="text-xl flex-shrink-0 opacity-40">○</span>
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  overdue,
  onTap,
}: {
  task: DailyTask
  overdue: boolean
  onTap: () => void
}) {
  const isDone = task.status === 'completed' || task.status === 'skipped'

  return (
    <button
      onClick={isDone ? undefined : onTap}
      disabled={isDone}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
        task.status === 'completed'
          ? 'bg-emerald-50 border-emerald-100'
          : task.status === 'skipped'
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : overdue
          ? 'bg-red-50 border-red-200 active:bg-red-100'
          : 'bg-white border-gray-100 active:bg-gray-50'
      }`}
    >
      <StatusIcon status={task.status} overdue={overdue} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${
          task.status === 'completed' ? 'text-emerald-700' : 'text-gray-800'
        }`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{task.description}</p>
        )}
        {task.status === 'completed' && task.completedAt && (
          <p className="text-xs text-emerald-500 mt-0.5">
            Done at {format(new Date(task.completedAt), 'h:mm a')}
          </p>
        )}
        {overdue && task.status === 'pending' && (
          <p className="text-xs text-red-500 mt-0.5 font-medium">Overdue</p>
        )}
      </div>
      <PriorityBadge priority={task.priority} />
    </button>
  )
}

// ── Task group ────────────────────────────────────────────────────────────────

function TaskGroup({
  window,
  tasks,
  isActive,
  onTaskTap,
  overdueTasks,
}: {
  window: TimeWindow
  tasks: DailyTask[]
  isActive: boolean
  onTaskTap: (task: DailyTask) => void
  overdueTasks: Set<string>
}) {
  const [expanded, setExpanded] = useState(isActive || tasks.some(t => t.status !== 'completed'))
  const cfg = WINDOW_CONFIG[window]

  const doneCount = tasks.filter(t => t.status === 'completed').length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{cfg.icon}</span>
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-gray-400 font-medium">
            {doneCount}/{tasks.length}
          </span>
        </div>
        <span className={`text-gray-400 text-xs font-medium transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              overdue={overdueTasks.has(task.id)}
              onTap={() => onTaskTap(task)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkerTasksPage() {
  const navigate = useNavigate()
  const appUser  = useAuthStore(s => s.appUser)
  const addToast = useUIStore(s => s.addToast)

  const today    = format(new Date(), 'yyyy-MM-dd')
  const hour     = new Date().getHours()
  const currentWindow: TimeWindow = hour < 12 ? 'morning' : hour < 17 ? 'midday' : 'evening'

  const checklistData = useTodayChecklist(appUser?.id)
  const streak        = useWorkerStreak(appUser?.id)
  const [generating, setGenerating] = useState(false)
  const [activeTask, setActiveTask] = useState<DailyTask | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const reminderRef = useRef<{ stop: () => void } | null>(null)

  // Generate checklist on mount
  useEffect(() => {
    if (!appUser) return
    const gen = async () => {
      setGenerating(true)
      try {
        await generateDailyChecklist(appUser, today)
      } catch (e) {
        console.error('Checklist generation failed:', e)
      } finally {
        setGenerating(false)
      }
    }
    void gen()
  }, [appUser?.id])

  // Init reminder scheduler
  useEffect(() => {
    if (!appUser?.id) return
    const cfg = loadReminderConfig()
    reminderRef.current = initReminderScheduler(appUser.id, cfg)
    return () => reminderRef.current?.stop()
  }, [appUser?.id])

  // Watch for 100% completion
  useEffect(() => {
    if (!checklistData) return
    const { checklist, tasks } = checklistData
    if (checklist.completionPct === 100 && tasks.length > 0) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
    }
  }, [checklistData?.checklist.completionPct])

  const handleTaskTap = (task: DailyTask) => {
    if (task.type === 'data_entry' && task.enterpriseInstanceId) {
      navigate(`/daily-entry/${task.enterpriseInstanceId}?date=${today}`)
      return
    }
    if (task.type === 'health_event' && task.linkedRecordId) {
      navigate('/health')
      return
    }
    setActiveTask(task)
  }

  const handleTaskCompleted = () => {
    if (checklistData) void recalculateChecklistCompletion(checklistData.checklist.id)
    addToast({ message: 'Task completed!', type: 'success' })
  }

  const handleRefresh = async () => {
    if (!appUser) return
    setGenerating(true)
    try {
      await generateDailyChecklist(appUser, today)
    } finally {
      setGenerating(false)
    }
  }

  // Group tasks by time window (preserving order)
  const windows: TimeWindow[] = ['morning', 'midday', 'evening', 'anytime']
  const grouped: Partial<Record<TimeWindow, DailyTask[]>> = {}
  if (checklistData) {
    for (const t of checklistData.tasks) {
      if (!grouped[t.timeWindow]) grouped[t.timeWindow] = []
      grouped[t.timeWindow]!.push(t)
    }
  }

  // Compute overdue tasks
  const overdueTasks = new Set<string>()
  if (checklistData) {
    for (const t of checklistData.tasks) {
      if (t.status === 'completed' || t.status === 'skipped') continue
      if (t.priority === 'optional') continue
      if (t.timeWindow === 'morning' && hour >= 12) overdueTasks.add(t.id)
      if (t.timeWindow === 'midday'  && hour >= 17) overdueTasks.add(t.id)
    }
  }

  const pct       = checklistData?.checklist.completionPct ?? 0
  const total     = checklistData?.tasks.length ?? 0
  const completed = checklistData?.tasks.filter(t => t.status === 'completed').length ?? 0
  const remaining = total - completed
  const allDone   = total > 0 && remaining === 0
  const dayName   = format(new Date(), 'EEEE, d MMMM')

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {showConfetti && <ConfettiBurst />}

      {/* Header */}
      <div className="bg-primary-600 px-4 pt-4 pb-5 safe-top">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-white/70 text-xs">{dayName}</p>
            <h1 className="text-white text-xl font-bold mt-0.5">
              {hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'},
              {appUser?.fullName ? ` ${appUser.fullName.split(' ')[0]}` : ''}!
            </h1>
          </div>
          <button onClick={() => navigate('/worker/history')}
            className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white">
            <History size={20} />
          </button>
        </div>

        {/* Progress ring + summary */}
        <div className="flex items-center gap-4 mt-3">
          <div className="relative flex-shrink-0">
            <ProgressRing pct={pct} size={72} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{pct}%</span>
            </div>
          </div>
          <div>
            {generating ? (
              <p className="text-white/80 text-sm">Preparing your tasks…</p>
            ) : allDone ? (
              <p className="text-white font-semibold text-base">All done! 🎉</p>
            ) : (
              <p className="text-white font-semibold text-base">{completed} of {total} done</p>
            )}
            {(streak?.currentStreak ?? 0) > 0 && (
              <p className="text-white/80 text-xs mt-0.5">
                🔥 {streak!.currentStreak} day streak
              </p>
            )}
          </div>
          <button onClick={() => void handleRefresh()}
            disabled={generating}
            className="ml-auto text-white/60 hover:text-white disabled:animate-spin">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {generating && !checklistData && (
          <div className="text-center py-12 text-gray-400 text-sm">
            <p className="text-3xl mb-3">📋</p>
            <p>Building your task list…</p>
          </div>
        )}

        {!generating && checklistData && total === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-semibold text-gray-700">No tasks today</p>
            <p className="text-xs mt-1">Your manager hasn't assigned tasks yet</p>
          </div>
        )}

        {windows.map(win => {
          const tasks = grouped[win]
          if (!tasks || tasks.length === 0) return null
          return (
            <TaskGroup
              key={win}
              window={win}
              tasks={tasks}
              isActive={win === currentWindow}
              onTaskTap={handleTaskTap}
              overdueTasks={overdueTasks}
            />
          )
        })}

        {/* Bottom summary */}
        {checklistData && total > 0 && (
          <div className={`rounded-2xl p-4 text-center ${allDone ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-gray-100 shadow-sm'}`}>
            {allDone ? (
              <>
                <p className="text-emerald-700 font-bold text-base">All done for today! 🎉</p>
                {(streak?.currentStreak ?? 0) > 1 && (
                  <p className="text-emerald-600 text-sm mt-1">You're on a {streak!.currentStreak}-day streak!</p>
                )}
                {streak?.currentStreak === 7  && <p className="text-xs text-emerald-500 mt-1">One full week! Excellent consistency! 🌟</p>}
                {streak?.currentStreak === 30 && <p className="text-xs text-emerald-500 mt-1">One month straight! You're a farming machine! 💪</p>}
              </>
            ) : (
              <p className="text-gray-600 text-sm">{remaining} more to go — you've got this!</p>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* Task completion sheet */}
      {activeTask && (
        <TaskCompletionSheet
          task={activeTask}
          onClose={() => setActiveTask(null)}
          onCompleted={handleTaskCompleted}
        />
      )}
    </div>
  )
}
