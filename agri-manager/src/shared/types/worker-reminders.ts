import type { EnterpriseType } from './enterprise'

export type TaskType =
  | 'data_entry'
  | 'health_event'
  | 'inventory_check'
  | 'custom_task'
  | 'feeding'
  | 'cleaning'
  | 'observation'

export type TaskPriority = 'required' | 'recommended' | 'optional'
export type TimeWindow    = 'morning' | 'midday' | 'evening' | 'anytime'
export type TaskStatus    = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type ReminderType  = 'morning_briefing' | 'midday_check' | 'evening_wrap' | 'overdue_nudge' | 'custom'
export type TemplateFrequency = 'daily' | 'weekdays_only' | 'specific_days'
export type TemplateCategory  = 'feeding' | 'cleaning' | 'maintenance' | 'observation' | 'security' | 'other'

// ── DailyTask ──────────────────────────────────────────────────────────────────

export interface DailyTask {
  id: string
  checklistId: string
  type: TaskType
  title: string
  description: string | null
  enterpriseInstanceId: string | null
  infrastructureId: string | null
  priority: TaskPriority
  scheduledTime: string | null    // HH:MM 24-hour
  timeWindow: TimeWindow
  status: TaskStatus
  completedAt: string | null      // ISO timestamp
  completedBy: string | null      // userId
  linkedRecordId: string | null   // ID of the record that fulfilled this task
  notes: string | null
  sortOrder: number               // for ordering within the checklist
}

// ── DailyTaskChecklist ─────────────────────────────────────────────────────────

export interface DailyTaskChecklist {
  id: string
  workerId: string
  date: string          // YYYY-MM-DD
  completionPct: number // 0-100, recalculated on each task update
  generatedAt: string   // ISO timestamp
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'conflict'
}

// ── ReminderSchedule ──────────────────────────────────────────────────────────

export interface ReminderSchedule {
  id: string
  organizationId: string
  role: 'worker' | 'supervisor'
  reminderType: ReminderType
  time: string           // HH:MM in 24-hour
  enabled: boolean
  daysOfWeek: number[]   // 0=Sunday … 6=Saturday
  message: string | null // null = use default template
  createdAt: string
  updatedAt: string
}

// ── TaskTemplate ──────────────────────────────────────────────────────────────

export interface TaskTemplate {
  id: string
  organizationId: string
  title: string
  description: string | null
  category: TemplateCategory
  infrastructureId: string | null          // null = applies to all matching infra
  enterpriseTypes: EnterpriseType[]        // empty array = all enterprise types
  timeWindow: TimeWindow
  priority: TaskPriority
  frequency: TemplateFrequency
  specificDays: number[] | null            // [1,3,5] = Mon/Wed/Fri; null unless frequency='specific_days'
  assignedWorkerIds: string[] | null       // null = all workers
  isActive: boolean
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'conflict'
}

// ── WorkerDailyStatus (computed, not stored) ──────────────────────────────────

export interface WorkerDailyStatus {
  workerId: string
  workerName: string
  date: string
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  lastActivityAt: string | null
  streak: number
  completionPct: number
}

// ── WorkerStreak (computed) ───────────────────────────────────────────────────

export interface WorkerStreak {
  currentStreak: number
  longestStreak: number
  thisWeekCompletionPct: number
  thisMonthCompletionPct: number
  totalTasksCompleted: number
}
