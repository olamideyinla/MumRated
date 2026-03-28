import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'
import type {
  DailyTask, DailyTaskChecklist, TaskTemplate, ReminderSchedule,
  WorkerStreak,
} from '../../../shared/types'

// ── useTodayChecklist ─────────────────────────────────────────────────────────

export interface ChecklistWithTasks {
  checklist: DailyTaskChecklist
  tasks: DailyTask[]
}

export function useTodayChecklist(workerId: string | undefined): ChecklistWithTasks | null | undefined {
  const today = format(new Date(), 'yyyy-MM-dd')
  return useLiveQuery(async () => {
    if (!workerId) return null
    const checklist = await db.dailyTaskChecklists
      .where('[workerId+date]').equals([workerId, today])
      .first()
    if (!checklist) return null
    const tasks = await db.dailyTasks
      .where('checklistId').equals(checklist.id)
      .sortBy('sortOrder')
    return { checklist, tasks }
  }, [workerId, today])
}

// ── useChecklistForDate ────────────────────────────────────────────────────────

export function useChecklistForDate(
  workerId: string | undefined,
  date: string,
): ChecklistWithTasks | null | undefined {
  return useLiveQuery(async () => {
    if (!workerId) return null
    const checklist = await db.dailyTaskChecklists
      .where('[workerId+date]').equals([workerId, date])
      .first()
    if (!checklist) return null
    const tasks = await db.dailyTasks
      .where('checklistId').equals(checklist.id)
      .sortBy('sortOrder')
    return { checklist, tasks }
  }, [workerId, date])
}

// ── useWorkerTaskHistory ──────────────────────────────────────────────────────

export interface DaySummary {
  date: string
  total: number
  completed: number
  pct: number            // 0-100
  hasChecklist: boolean
}

export function useWorkerTaskHistory(
  workerId: string | undefined,
  days = 30,
): DaySummary[] | undefined {
  return useLiveQuery(async () => {
    if (!workerId) return []
    const today = new Date()
    const results: DaySummary[] = []
    for (let i = 0; i < days; i++) {
      const date = format(subDays(today, i), 'yyyy-MM-dd')
      const checklist = await db.dailyTaskChecklists
        .where('[workerId+date]').equals([workerId, date])
        .first()
      if (!checklist) {
        results.push({ date, total: 0, completed: 0, pct: 0, hasChecklist: false })
        continue
      }
      const tasks = await db.dailyTasks.where('checklistId').equals(checklist.id).toArray()
      const completed = tasks.filter(t => t.status === 'completed').length
      const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
      results.push({ date, total: tasks.length, completed, pct, hasChecklist: true })
    }
    return results
  }, [workerId, days])
}

// ── useWorkerStreak ───────────────────────────────────────────────────────────

export function useWorkerStreak(workerId: string | undefined): WorkerStreak | undefined {
  return useLiveQuery(async () => {
    if (!workerId) return { currentStreak: 0, longestStreak: 0, thisWeekCompletionPct: 0, thisMonthCompletionPct: 0, totalTasksCompleted: 0 }

    const today = new Date()
    const allChecklists = await db.dailyTaskChecklists.where('workerId').equals(workerId).toArray()
    const checklistMap  = new Map(allChecklists.map(c => [c.date, c.id]))

    // Total tasks completed (lifetime)
    const allTasks = await db.dailyTasks
      .filter(t => {
        const cl = allChecklists.find(c => c.id === t.checklistId)
        return !!cl
      })
      .toArray()
    const totalTasksCompleted = allTasks.filter(t => t.status === 'completed').length

    // Helper: get completion pct for a date
    const getPct = async (date: string): Promise<number> => {
      const clId = checklistMap.get(date)
      if (!clId) return -1 // no checklist = unknown
      const tasks = await db.dailyTasks.where('checklistId').equals(clId).toArray()
      if (tasks.length === 0) return 100
      return Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    }

    // Current streak — count consecutive days ending today with 100% completion
    let currentStreak = 0
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd')
      const pct = await getPct(d)
      if (pct === 100) currentStreak++
      else if (pct === -1 && i === 0) continue // skip today if no checklist yet
      else break
    }

    // Longest streak ever
    const sortedDates = [...checklistMap.keys()].sort()
    let longestStreak = 0
    let tempStreak    = 0
    for (const d of sortedDates) {
      const pct = await getPct(d)
      if (pct === 100) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak) }
      else tempStreak = 0
    }

    // This week
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd   = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekDates = sortedDates.filter(d => d >= weekStart && d <= weekEnd)
    let weekTotal = 0, weekCompleted = 0
    for (const d of weekDates) {
      const clId = checklistMap.get(d)!
      const tasks = await db.dailyTasks.where('checklistId').equals(clId).toArray()
      weekTotal += tasks.length
      weekCompleted += tasks.filter(t => t.status === 'completed').length
    }
    const thisWeekCompletionPct = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0

    // This month
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
    const monthEnd   = format(endOfMonth(today), 'yyyy-MM-dd')
    const monthDates = sortedDates.filter(d => d >= monthStart && d <= monthEnd)
    let monthTotal = 0, monthCompleted = 0
    for (const d of monthDates) {
      const clId = checklistMap.get(d)!
      const tasks = await db.dailyTasks.where('checklistId').equals(clId).toArray()
      monthTotal += tasks.length
      monthCompleted += tasks.filter(t => t.status === 'completed').length
    }
    const thisMonthCompletionPct = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0

    return { currentStreak, longestStreak, thisWeekCompletionPct, thisMonthCompletionPct, totalTasksCompleted }
  }, [workerId])
}

// ── useTeamDailyStatus ────────────────────────────────────────────────────────

export interface TeamMemberStatus {
  workerId: string
  workerName: string
  total: number
  completed: number
  pct: number
  overdue: number
}

export function useTeamDailyStatus(
  orgId: string | undefined,
  date: string,
): TeamMemberStatus[] | undefined {
  const userId = useAuthStore(s => s.userId)
  return useLiveQuery(async () => {
    if (!orgId || !userId) return []
    const workers = await db.appUsers
      .where('organizationId').equals(orgId)
      .filter(u => u.role === 'worker' && u.isActive)
      .toArray()

    const results: TeamMemberStatus[] = []
    for (const w of workers) {
      const checklist = await db.dailyTaskChecklists
        .where('[workerId+date]').equals([w.id, date])
        .first()
      if (!checklist) {
        results.push({ workerId: w.id, workerName: w.fullName, total: 0, completed: 0, pct: 0, overdue: 0 })
        continue
      }
      const tasks    = await db.dailyTasks.where('checklistId').equals(checklist.id).toArray()
      const now      = new Date()
      const hour     = now.getHours()
      const completed = tasks.filter(t => t.status === 'completed').length
      // Overdue: required tasks in past time windows not completed
      const overdue = tasks.filter(t => {
        if (t.status === 'completed' || t.status === 'skipped') return false
        if (t.priority !== 'required') return false
        if (t.timeWindow === 'morning' && hour >= 12) return true
        if (t.timeWindow === 'midday' && hour >= 17) return true
        return false
      }).length
      const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
      results.push({ workerId: w.id, workerName: w.fullName, total: tasks.length, completed, pct, overdue })
    }
    return results.sort((a, b) => b.pct - a.pct)
  }, [orgId, date, userId])
}

// ── useTaskTemplates ──────────────────────────────────────────────────────────

export function useTaskTemplates(orgId: string | undefined): TaskTemplate[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    return db.taskTemplates.where('organizationId').equals(orgId).toArray()
  }, [orgId])
}

// ── useReminderSchedules ──────────────────────────────────────────────────────

export function useReminderSchedules(orgId: string | undefined): ReminderSchedule[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    return db.reminderSchedules.where('organizationId').equals(orgId).toArray()
  }, [orgId])
}

// ── useWorkerWeeklyGrid ────────────────────────────────────────────────────────

export interface WeeklyGridCell {
  date: string
  pct: number    // -1 = no checklist
}

export interface WeeklyGridRow {
  workerId: string
  workerName: string
  cells: WeeklyGridCell[]  // 7 cells, Mon-Sun
}

export function useWorkerWeeklyGrid(
  orgId: string | undefined,
  weekStart: string,
  weekEnd: string,
): WeeklyGridRow[] | undefined {
  const userId = useAuthStore(s => s.userId)
  return useLiveQuery(async () => {
    if (!orgId || !userId) return []
    const workers = await db.appUsers
      .where('organizationId').equals(orgId)
      .filter(u => u.role === 'worker' && u.isActive)
      .toArray()

    // Build dates in week
    const dates: string[] = []
    const cur = new Date(weekStart + 'T00:00:00')
    while (format(cur, 'yyyy-MM-dd') <= weekEnd) {
      dates.push(format(cur, 'yyyy-MM-dd'))
      cur.setDate(cur.getDate() + 1)
    }

    const rows: WeeklyGridRow[] = []
    for (const w of workers) {
      const cells: WeeklyGridCell[] = []
      for (const date of dates) {
        const checklist = await db.dailyTaskChecklists
          .where('[workerId+date]').equals([w.id, date])
          .first()
        if (!checklist) { cells.push({ date, pct: -1 }); continue }
        const tasks = await db.dailyTasks.where('checklistId').equals(checklist.id).toArray()
        const completed = tasks.filter(t => t.status === 'completed').length
        const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 100
        cells.push({ date, pct })
      }
      rows.push({ workerId: w.id, workerName: w.fullName, cells })
    }
    return rows
  }, [orgId, weekStart, weekEnd, userId])
}
