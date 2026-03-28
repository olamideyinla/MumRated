import { db } from '../database/db'
import { v4 as uuidv4 } from 'uuid'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConflictRecord {
  id: string
  tableName: string
  recordId: string
  fieldName: string
  localValue: unknown
  remoteValue: unknown
  localUpdatedAt: string
  remoteUpdatedAt: string
  resolved: boolean
  createdAt: string
}

type Resolution = 'local' | 'remote' | 'conflict_flagged'

// ── Resolver ──────────────────────────────────────────────────────────────────

export const conflictResolver = {
  /**
   * Decide which version of a record wins.
   *
   * Rules:
   * 1. If timestamps differ → newer updatedAt wins.
   * 2. If timestamps are equal and a numeric field differs → flag as conflict
   *    (store ConflictRecord, mark syncStatus='conflict', return 'conflict_flagged').
   * 3. If timestamps are equal and no numeric field differs → remote wins (idempotent).
   */
  async resolveConflict(
    tableName: string,
    localRecord: Record<string, unknown>,
    remoteRecord: Record<string, unknown>,
  ): Promise<Resolution> {
    const localTs = localRecord.updatedAt as string | undefined
    const remoteTs = remoteRecord.updatedAt as string | undefined

    // No timestamps — default to remote
    if (!localTs || !remoteTs) return 'remote'

    if (localTs > remoteTs) return 'local'
    if (remoteTs > localTs) return 'remote'

    // Same timestamp — look for differing numeric fields
    const conflictingFields = findDifferingNumericFields(localRecord, remoteRecord)

    if (conflictingFields.length === 0) return 'remote'

    // Write one ConflictRecord per differing field
    const now = new Date().toISOString()
    for (const field of conflictingFields) {
      const conflict: ConflictRecord = {
        id: uuidv4(),
        tableName,
        recordId: localRecord.id as string,
        fieldName: field,
        localValue: localRecord[field],
        remoteValue: remoteRecord[field],
        localUpdatedAt: localTs,
        remoteUpdatedAt: remoteTs,
        resolved: false,
        createdAt: now,
      }
      await db.conflicts.put(conflict)
    }

    return 'conflict_flagged'
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findDifferingNumericFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): string[] {
  const fields: string[] = []
  const skipKeys = new Set(['id', 'updatedAt', 'createdAt', 'syncStatus'])

  for (const key of Object.keys(remote)) {
    if (skipKeys.has(key)) continue
    if (typeof remote[key] === 'number' && typeof local[key] === 'number') {
      if (remote[key] !== local[key]) {
        fields.push(key)
      }
    }
  }

  return fields
}
