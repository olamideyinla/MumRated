import { format } from 'date-fns'
import { db } from '../database/db'
import type { DailyTask } from '../../shared/types'

// ── Default reminder schedule ─────────────────────────────────────────────────

export interface ReminderConfig {
  morningTime:  string  // HH:MM
  middayTime:   string
  eveningTime:  string
  enabled:      boolean
  workDays:     number[] // 0=Sun..6=Sat
  maxNudges:    number
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  morningTime: '06:00',
  middayTime:  '12:00',
  eveningTime: '17:00',
  enabled:     true,
  workDays:    [1, 2, 3, 4, 5, 6], // Mon–Sat
  maxNudges:   3,
}

// ── LocalStorage keys ─────────────────────────────────────────────────────────

const NUDGE_COUNT_KEY = (date: string) => `agri_nudges_${date}`
const CONFIG_KEY      = 'agri_reminder_config'

export function loadReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { ...DEFAULT_REMINDER_CONFIG, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_REMINDER_CONFIG }
}

export function saveReminderConfig(cfg: Partial<ReminderConfig>): void {
  const current = loadReminderConfig()
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...cfg }))
}

// ── Notification helper ───────────────────────────────────────────────────────

function showNotification(title: string, body: string, tag: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/icon-192.png', tag, badge: '/icon-192.png' })
}

// ── Build morning briefing ────────────────────────────────────────────────────

async function buildMorningBriefing(workerId: string, date: string): Promise<{ title: string; body: string }> {
  const checklist = await db.dailyTaskChecklists
    .where('[workerId+date]').equals([workerId, date])
    .first()

  if (!checklist) return { title: 'Good morning!', body: 'Your tasks for today are being prepared.' }

  const tasks = await db.dailyTasks.where('checklistId').equals(checklist.id).toArray()
  const required = tasks.filter(t => t.priority === 'required')
  const total    = tasks.length
  const firstThree = required.slice(0, 3).map(t => `• ${t.title}`).join('\n')

  return {
    title: `Good morning! ${total} task${total !== 1 ? 's' : ''} today`,
    body: firstThree || `You have ${total} tasks for today.`,
  }
}

// ── Check for overdue nudge ───────────────────────────────────────────────────

async function getOverdueTasks(workerId: string, date: string): Promise<DailyTask[]> {
  const checklist = await db.dailyTaskChecklists
    .where('[workerId+date]').equals([workerId, date])
    .first()
  if (!checklist) return []

  const now  = new Date()
  const hour = now.getHours()

  const tasks = await db.dailyTasks.where('checklistId').equals(checklist.id).toArray()
  return tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'skipped') return false
    if (t.priority === 'optional') return false
    if (t.timeWindow === 'morning' && hour >= 12)  return true
    if (t.timeWindow === 'midday'  && hour >= 17)  return true
    return false
  })
}

// ── Nudge throttle ────────────────────────────────────────────────────────────

function getNudgesUsed(date: string): number {
  return parseInt(localStorage.getItem(NUDGE_COUNT_KEY(date)) ?? '0', 10)
}

function incrementNudgeCount(date: string): void {
  const n = getNudgesUsed(date) + 1
  localStorage.setItem(NUDGE_COUNT_KEY(date), String(n))
}

// ── Parse HH:MM to ms from now ────────────────────────────────────────────────

function msUntilTime(hhmm: string): number {
  const [hh, mm] = hhmm.split(':').map(Number)
  const target = new Date()
  target.setHours(hh, mm, 0, 0)
  const diff = target.getTime() - Date.now()
  return diff < 0 ? diff + 86_400_000 : diff // next occurrence
}

// ── ReminderScheduler ─────────────────────────────────────────────────────────

interface SchedulerHandle {
  stop: () => void
}

export function initReminderScheduler(
  workerId: string,
  config: ReminderConfig = loadReminderConfig(),
): SchedulerHandle {
  const timers: ReturnType<typeof setTimeout>[] = []
  const today    = format(new Date(), 'yyyy-MM-dd')
  const dayOfWeek = new Date().getDay()

  if (!config.enabled || !config.workDays.includes(dayOfWeek)) {
    return { stop: () => { /* no-op */ } }
  }

  // Morning briefing
  const morningMs = msUntilTime(config.morningTime)
  if (morningMs < 86_400_000) {
    timers.push(setTimeout(async () => {
      const { title, body } = await buildMorningBriefing(workerId, today)
      showNotification(title, body, 'agri-morning')
    }, morningMs))
  }

  // Midday check — only if morning tasks incomplete
  const middayMs = msUntilTime(config.middayTime)
  if (middayMs < 86_400_000) {
    timers.push(setTimeout(async () => {
      const overdue = await getOverdueTasks(workerId, today)
      if (overdue.length === 0) return
      showNotification(
        'Morning tasks check',
        `${overdue.length} morning task${overdue.length > 1 ? 's' : ''} still pending — ${overdue[0].title}`,
        'agri-midday',
      )
    }, middayMs))
  }

  // Evening wrap-up
  const eveningMs = msUntilTime(config.eveningTime)
  if (eveningMs < 86_400_000) {
    timers.push(setTimeout(async () => {
      const checklist = await db.dailyTaskChecklists
        .where('[workerId+date]').equals([workerId, today])
        .first()
      if (!checklist) return

      const tasks     = await db.dailyTasks.where('checklistId').equals(checklist.id).toArray()
      const total     = tasks.length
      const completed = tasks.filter(t => t.status === 'completed').length
      const remaining = total - completed

      if (remaining === 0) {
        showNotification('Great work! 🌟', `All ${total} tasks done today. Tap to see your streak!`, 'agri-evening')
      } else {
        showNotification(
          'End of day check',
          `You've completed ${completed} of ${total} tasks. ${remaining} remaining.`,
          'agri-evening',
        )
      }
    }, eveningMs))
  }

  // Overdue nudge — check every 30 min
  const nudgeInterval = setInterval(async () => {
    const nudgesUsed = getNudgesUsed(today)
    if (nudgesUsed >= config.maxNudges) return

    const overdue = await getOverdueTasks(workerId, today)
    if (overdue.length === 0) return

    const first = overdue[0]
    const windowLabel = first.timeWindow === 'morning' ? 'morning' : 'midday'
    showNotification(
      'Task reminder',
      `${first.title} was due this ${windowLabel}. Tap to complete.`,
      `agri-nudge-${first.id}`,
    )
    incrementNudgeCount(today)
  }, 30 * 60 * 1_000)

  return {
    stop: () => {
      timers.forEach(t => clearTimeout(t))
      clearInterval(nudgeInterval)
    },
  }
}
