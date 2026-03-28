import { useLiveQuery } from 'dexie-react-hooks'
import { useAuthStore } from '../../../stores/auth-store'
import { db, type AuditRecord } from '../db'
import { newId, nowIso } from '../../../shared/types/base'

// ── Diff helper ───────────────────────────────────────────────────────────────

function computeDiff(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {}
  const skipKeys = new Set(['syncStatus', 'updatedAt'])
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])
  for (const key of allKeys) {
    if (skipKeys.has(key)) continue
    if (JSON.stringify(oldRecord[key]) !== JSON.stringify(newRecord[key])) {
      diff[key] = { old: oldRecord[key], new: newRecord[key] }
    }
  }
  return diff
}

// ── Audit filter type ─────────────────────────────────────────────────────────

export interface AuditFilter {
  userId?: string
  action?: AuditRecord['action']
  tableName?: string
  enterpriseInstanceId?: string
  fromDate?: string  // ISO date string YYYY-MM-DD
  toDate?: string
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuditLog() {
  const appUser = useAuthStore(s => s.appUser)

  const logCreate = async (
    tableName: string,
    record: Record<string, unknown>,
  ) => {
    if (!appUser) return
    const entry: AuditRecord = {
      id: newId(),
      userId: appUser.id,
      userFullName: appUser.fullName,
      action: 'create',
      tableName,
      recordId: record.id as string,
      changes: JSON.stringify(record),
      enterpriseInstanceId: record.enterpriseInstanceId as string | undefined,
      timestamp: nowIso(),
    }
    await db.auditLog.put(entry)
  }

  const logUpdate = async (
    tableName: string,
    oldRecord: Record<string, unknown>,
    newRecord: Record<string, unknown>,
  ) => {
    if (!appUser) return
    const diff = computeDiff(oldRecord, newRecord)
    if (Object.keys(diff).length === 0) return
    const entry: AuditRecord = {
      id: newId(),
      userId: appUser.id,
      userFullName: appUser.fullName,
      action: 'update',
      tableName,
      recordId: newRecord.id as string,
      changes: JSON.stringify(diff),
      enterpriseInstanceId: newRecord.enterpriseInstanceId as string | undefined,
      timestamp: nowIso(),
    }
    await db.auditLog.put(entry)
  }

  const logDelete = async (
    tableName: string,
    record: Record<string, unknown>,
  ) => {
    if (!appUser) return
    const entry: AuditRecord = {
      id: newId(),
      userId: appUser.id,
      userFullName: appUser.fullName,
      action: 'delete',
      tableName,
      recordId: record.id as string,
      changes: JSON.stringify(record),
      enterpriseInstanceId: record.enterpriseInstanceId as string | undefined,
      timestamp: nowIso(),
    }
    await db.auditLog.put(entry)
  }

  return { logCreate, logUpdate, logDelete }
}

/**
 * Live-query paginated audit log entries, optionally filtered.
 * Returns the 50 most recent entries matching the filter.
 */
export function useAuditLogQuery(filter?: AuditFilter): AuditRecord[] | undefined {
  return useLiveQuery(async () => {
    let records: AuditRecord[]

    if (filter?.userId) {
      records = await db.auditLog.where('userId').equals(filter.userId).reverse().sortBy('timestamp')
    } else {
      records = await db.auditLog.orderBy('timestamp').reverse().toArray()
    }

    // Apply remaining filters in memory
    if (filter?.action) records = records.filter(r => r.action === filter.action)
    if (filter?.tableName) records = records.filter(r => r.tableName === filter.tableName)
    if (filter?.enterpriseInstanceId) records = records.filter(r => r.enterpriseInstanceId === filter.enterpriseInstanceId)
    if (filter?.fromDate) records = records.filter(r => r.timestamp >= filter.fromDate!)
    if (filter?.toDate) records = records.filter(r => r.timestamp <= filter.toDate! + 'T23:59:59')

    return records.slice(0, 50)
  }, [filter?.userId, filter?.action, filter?.tableName, filter?.enterpriseInstanceId, filter?.fromDate, filter?.toDate])
}
