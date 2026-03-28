import type { HealthEventType, HealthEventStatus } from '../../shared/types'

export const EVENT_TYPE_CONFIG: Record<HealthEventType, { label: string; dot: string }> = {
  vaccination: { label: 'Vaccination', dot: 'bg-blue-500' },
  treatment:   { label: 'Treatment',   dot: 'bg-orange-500' },
  deworming:   { label: 'Deworming',   dot: 'bg-purple-500' },
  vitamin:     { label: 'Vitamin',     dot: 'bg-yellow-500' },
  test:        { label: 'Test',        dot: 'bg-cyan-500' },
  inspection:  { label: 'Inspection',  dot: 'bg-green-500' },
  other:       { label: 'Other',       dot: 'bg-gray-400' },
}

export const STATUS_CONFIG: Record<HealthEventStatus, { label: string; chip: string }> = {
  upcoming:  { label: 'Upcoming',  chip: 'bg-gray-100 text-gray-600' },
  due_today: { label: 'Due Today', chip: 'bg-amber-100 text-amber-700' },
  overdue:   { label: 'Overdue',   chip: 'bg-red-100 text-red-700' },
  completed: { label: 'Done',      chip: 'bg-emerald-100 text-emerald-700' },
  skipped:   { label: 'Skipped',   chip: 'bg-gray-100 text-gray-500' },
}
