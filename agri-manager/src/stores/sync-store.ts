import { create } from 'zustand'
import { db } from '../core/database/db'
import type { ConflictRecord } from '../core/sync/conflict-resolver'

type SyncTable = {
  get(id: string): Promise<Record<string, unknown> | undefined>
  put(record: Record<string, unknown>): Promise<string | number>
}

function getDbTable(name: string): SyncTable | undefined {
  return (db as unknown as Record<string, SyncTable | undefined>)[name]
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncError {
  id: string
  message: string
  timestamp: Date
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface SyncState {
  status: SyncStatus
  lastSyncTime: Date | null
  pendingCount: number
  errors: SyncError[]
  conflicts: ConflictRecord[]
  // Actions
  setStatus: (s: SyncStatus) => void
  setLastSyncTime: (d: Date) => void
  setPendingCount: (n: number) => void
  addError: (e: SyncError) => void
  clearErrors: () => void
  setConflicts: (c: ConflictRecord[]) => void
  resolveConflict: (conflictId: string, chosenValue: unknown) => Promise<void>
  loadConflicts: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncTime: null,
  pendingCount: 0,
  errors: [],
  conflicts: [],

  setStatus: (status) => set({ status }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  addError: (e) => set((s) => ({ errors: [...s.errors.slice(-19), e] })),
  clearErrors: () => set({ errors: [] }),
  setConflicts: (conflicts) => set({ conflicts }),

  async resolveConflict(conflictId, chosenValue) {
    const conflict = await db.conflicts.get(conflictId)
    if (!conflict) return

    // Apply chosen value to the affected record
    const table = getDbTable(conflict.tableName)
    if (table) {
      const record = await table.get(conflict.recordId)
      if (record) {
        await table.put({
          ...record,
          [conflict.fieldName]: chosenValue,
          syncStatus: 'pending', // re-queue so it pushes to server
        })
      }
    }

    // Mark conflict resolved
    await db.conflicts.put({ ...conflict, resolved: true })

    // Refresh in-store conflict list
    const remaining = await db.conflicts.where('resolved').equals(0).toArray()
    set({ conflicts: remaining })
  },

  async loadConflicts() {
    const all = await db.conflicts.where('resolved').equals(0).toArray()
    set({ conflicts: all })
  },
}))
