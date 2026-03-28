import {
  format, formatDistanceToNow, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subMonths, subQuarters, differenceInDays,
  parseISO, isValid,
} from 'date-fns'

export function formatDate(date: Date | string, pattern = 'd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? format(d, pattern) : '—'
}

export function formatShortDate(date: Date): string {
  return format(date, 'd MMM')
}

export function timeAgo(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true })
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(differenceInDays(a, b))
}

export type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

export function dateRangeForPreset(preset: DatePreset): DateRange {
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_month': {
      const last = subMonths(now, 1)
      return { from: startOfMonth(last), to: endOfMonth(last) }
    }
    case 'this_quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) }
    case 'last_quarter': {
      const last = subQuarters(now, 1)
      return { from: startOfQuarter(last), to: endOfQuarter(last) }
    }
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now) }
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) }
  }
}
