import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'
import type { Worker, AttendanceRecord, CasualLaborEntry, PayrollEntry, WorkerType } from '../../../shared/types'

// ── useWorkers ─────────────────────────────────────────────────────────────────

/** All workers for the current user's organization, live-updating */
export function useWorkers(orgId: string | undefined): Worker[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    return db.workers.where('organizationId').equals(orgId).sortBy('name')
  }, [orgId])
}

// ── useActiveWorkers ───────────────────────────────────────────────────────────

/** Active workers, optionally filtered by workerType */
export function useActiveWorkers(orgId: string | undefined, type?: WorkerType): Worker[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    const all = await db.workers
      .where('organizationId').equals(orgId)
      .filter(w => w.status === 'active' && (type == null || w.workerType === type))
      .toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [orgId, type])
}

// ── useAttendanceForDate ───────────────────────────────────────────────────────

/** Returns a Map<workerId, AttendanceRecord> for a specific date */
export function useAttendanceForDate(
  orgId: string | undefined,
  date: string,
): Map<string, AttendanceRecord> | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return new Map()
    const workers = await db.workers
      .where('organizationId').equals(orgId)
      .filter(w => w.status === 'active' && w.workerType === 'permanent')
      .toArray()
    const workerIds = workers.map(w => w.id)
    if (workerIds.length === 0) return new Map()
    const records = await db.attendanceRecords
      .where('date').equals(date)
      .filter(r => workerIds.includes(r.workerId))
      .toArray()
    return new Map(records.map(r => [r.workerId, r]))
  }, [orgId, date])
}

// ── useWorkerAttendanceHistory ─────────────────────────────────────────────────

/** Attendance records for a specific worker in a date range */
export function useWorkerAttendanceHistory(
  workerId: string | undefined,
  from: string,
  to: string,
): AttendanceRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!workerId) return []
    const records = await db.attendanceRecords
      .where('workerId').equals(workerId)
      .filter(r => r.date >= from && r.date <= to)
      .toArray()
    return records.sort((a, b) => b.date.localeCompare(a.date))
  }, [workerId, from, to])
}

// ── useCasualLaborEntries ──────────────────────────────────────────────────────

/** Casual labor entries for the org, optionally filtered by date range */
export function useCasualLaborEntries(
  orgId: string | undefined,
  from?: string,
  to?: string,
): CasualLaborEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    const all = await db.casualLaborEntries
      .where('organizationId').equals(orgId)
      .toArray()
    const filtered = from && to
      ? all.filter(e => e.date >= from && e.date <= to)
      : all
    return filtered.sort((a, b) => b.date.localeCompare(a.date))
  }, [orgId, from, to])
}

// ── usePayrollEntries ──────────────────────────────────────────────────────────

/** Payroll entries for a specific worker, newest first */
export function usePayrollEntries(workerId: string | undefined): PayrollEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!workerId) return []
    const entries = await db.payrollEntries
      .where('workerId').equals(workerId)
      .toArray()
    return entries.sort((a, b) => b.periodStart.localeCompare(a.periodStart))
  }, [workerId])
}

// ── usePayrollEntriesForPeriod ────────────────────────────────────────────────

/** All payroll entries for an org in a date range */
export function usePayrollEntriesForPeriod(
  orgId: string | undefined,
  from: string,
  to: string,
): PayrollEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    const workers = await db.workers
      .where('organizationId').equals(orgId)
      .toArray()
    const workerIds = new Set(workers.map(w => w.id))
    const all = await db.payrollEntries.toArray()
    return all.filter(
      e => workerIds.has(e.workerId) && e.periodEnd >= from && e.periodStart <= to,
    )
  }, [orgId, from, to])
}

// ── useTodayAttendanceSummary ──────────────────────────────────────────────────

export interface AttendanceSummary {
  permanentCount: number
  recordedCount: number
  unrecorded: boolean
}

/** Returns summary of today's attendance for permanent workers */
export function useTodayAttendanceSummary(orgId: string | undefined): AttendanceSummary | undefined {
  const today = format(new Date(), 'yyyy-MM-dd')
  return useLiveQuery(async () => {
    if (!orgId) return { permanentCount: 0, recordedCount: 0, unrecorded: false }
    const permanent = await db.workers
      .where('organizationId').equals(orgId)
      .filter(w => w.status === 'active' && w.workerType === 'permanent')
      .toArray()
    const permanentCount = permanent.length
    if (permanentCount === 0) return { permanentCount: 0, recordedCount: 0, unrecorded: false }
    const workerIds = permanent.map(w => w.id)
    const records = await db.attendanceRecords
      .where('date').equals(today)
      .filter(r => workerIds.includes(r.workerId))
      .toArray()
    const recordedCount = records.length
    return {
      permanentCount,
      recordedCount,
      unrecorded: permanentCount > 0 && recordedCount < permanentCount,
    }
  }, [orgId, today])
}

// ── useMonthlyLaborCost ───────────────────────────────────────────────────────

/** Total labor cost (financial transactions with category='labor') for a given month */
export function useMonthlyLaborCost(orgId: string | undefined, year: number, month: number): number | undefined {
  const userId = useAuthStore(s => s.user?.id)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-31`
  return useLiveQuery(async () => {
    if (!orgId || !userId) return 0
    const txns = await db.financialTransactions
      .where('organizationId').equals(orgId)
      .filter(t => t.category === 'labor' && t.date >= from && t.date <= to)
      .toArray()
    return txns.reduce((s, t) => s + t.amount, 0)
  }, [orgId, year, month, userId])
}
