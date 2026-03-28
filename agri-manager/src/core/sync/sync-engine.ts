import { supabase } from '../config/supabase'
import { db } from '../database/db'
import { useSyncStore } from '../../stores/sync-store'
import { conflictResolver } from './conflict-resolver'
import {
  SYNC_ORDER,
  TABLE_SUPABASE_NAME,
  INDEXED_SYNC_STATUS_TABLES,
  toSupabaseRecord,
  fromSupabaseRecord,
  type SyncTableName,
} from './table-config'

const PUSH_CHUNK_SIZE = 100
const PULL_PAGE_SIZE = 500

// ── Type-safe db table accessor ────────────────────────────────────────────────

type SyncTable = {
  where(field: string): { equals(v: unknown): { toArray(): Promise<Record<string, unknown>[]>; count(): Promise<number> } }
  toArray(): Promise<Record<string, unknown>[]>
  get(id: string): Promise<Record<string, unknown> | undefined>
  put(record: Record<string, unknown>): Promise<string | number>
  bulkPut(records: Record<string, unknown>[]): Promise<string | number>
}

function getDbTable(name: SyncTableName): SyncTable {
  return (db as unknown as Record<SyncTableName, SyncTable>)[name]
}

// ── SyncEngine ────────────────────────────────────────────────────────────────

class SyncEngine {
  private _running = false

  /** Push all pending records, then pull all remote changes. */
  async fullSync(): Promise<void> {
    if (this._running) return
    if (!navigator.onLine) {
      useSyncStore.getState().setStatus('offline')
      return
    }
    this._running = true
    useSyncStore.getState().setStatus('syncing')

    try {
      await this.pushChanges()
      await this.pullChanges()
      const now = new Date()
      useSyncStore.getState().setLastSyncTime(now)
      await db.syncMeta.put({ tableName: '__lastSync__', lastSyncedAt: now.toISOString() })
      useSyncStore.getState().setStatus('idle')
    } catch (err) {
      console.error('[SyncEngine] fullSync error:', err)
      useSyncStore.getState().addError({
        id: crypto.randomUUID(),
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      })
      useSyncStore.getState().setStatus('error')
    } finally {
      this._running = false
    }
  }

  /** Push all tables with pending records to Supabase. */
  async pushChanges(): Promise<void> {
    for (const tableName of SYNC_ORDER) {
      await this._withRetry(() => this._pushTable(tableName))
    }
    await this._refreshPendingCount()
  }

  /** Pull remote changes for all tables from Supabase. */
  async pullChanges(): Promise<void> {
    for (const tableName of SYNC_ORDER) {
      await this._pullTable(tableName)
    }
    await this._refreshPendingCount()
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async _pushTable(tableName: SyncTableName): Promise<void> {
    // Get pending records
    const table = getDbTable(tableName)
    let pendingRecords: Record<string, unknown>[]

    if (INDEXED_SYNC_STATUS_TABLES.has(tableName)) {
      pendingRecords = await table.where('syncStatus').equals('pending').toArray()
    } else {
      const all = await table.toArray()
      pendingRecords = all.filter(
        (r: Record<string, unknown>) => r.syncStatus === 'pending',
      )
    }

    if (pendingRecords.length === 0) return

    const supabaseTable = TABLE_SUPABASE_NAME[tableName]

    // Push all chunks first — only mark synced after ALL succeed.
    // This prevents orphaned "synced" records if a later chunk fails.
    for (let i = 0; i < pendingRecords.length; i += PUSH_CHUNK_SIZE) {
      const chunk = pendingRecords.slice(i, i + PUSH_CHUNK_SIZE)
      const payload = chunk.map((r) => toSupabaseRecord(r))

      const { error } = await supabase
        .from(supabaseTable)
        .upsert(payload, { onConflict: 'id' })

      if (error) {
        // Network / auth errors bubble up so _withRetry can handle them.
        // Upsert to Supabase is idempotent, so successfully pushed chunks
        // will be no-ops on the next sync attempt.
        throw error
      }
    }

    // All chunks succeeded — now mark the entire batch as synced
    const synced = pendingRecords.map((r) => ({ ...r, syncStatus: 'synced' as const }))
    await table.bulkPut(synced)
  }

  private async _pullTable(tableName: SyncTableName): Promise<void> {
    const table = getDbTable(tableName)
    const supabaseTable = TABLE_SUPABASE_NAME[tableName]

    const metaKey = `pull_${tableName}`
    const meta = await db.syncMeta.get(metaKey)
    const since = meta?.lastSyncedAt ?? '1970-01-01T00:00:00.000Z'

    let offset = 0
    let maxUpdatedAt = since
    let totalFetched = 0

    while (true) {
      const { data, error } = await supabase
        .from(supabaseTable)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at')
        .range(offset, offset + PULL_PAGE_SIZE - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      totalFetched += data.length

      for (const rawRecord of data) {
        const record = fromSupabaseRecord(rawRecord as Record<string, unknown>) as Record<string, unknown>
        const id = record.id as string

        // Track max updatedAt for cursor
        const ts = record.updatedAt as string | undefined
        if (ts && ts > maxUpdatedAt) maxUpdatedAt = ts

        const existing = await table.get(id)
        if (!existing) {
          await table.put({ ...record, syncStatus: 'synced' })
        } else if (existing.syncStatus === 'synced') {
          await table.put({ ...record, syncStatus: 'synced' })
        } else if (existing.syncStatus === 'pending' || existing.syncStatus === 'conflict') {
          const resolution = await conflictResolver.resolveConflict(tableName, existing, record)
          if (resolution === 'remote') {
            await table.put({ ...record, syncStatus: 'synced' })
          } else if (resolution === 'conflict_flagged') {
            // Remote value stored, local marked as conflict
            await table.put({ ...record, syncStatus: 'conflict' })
          }
          // 'local' → keep existing, do nothing
        }
      }

      if (data.length < PULL_PAGE_SIZE) break
      offset += PULL_PAGE_SIZE
    }

    if (totalFetched > 0) {
      await db.syncMeta.put({ tableName: metaKey, lastSyncedAt: maxUpdatedAt })
    }
  }

  private async _withRetry(fn: () => Promise<void>): Promise<void> {
    if (!navigator.onLine) {
      await this._registerBackgroundSync()
      return
    }
    try {
      await fn()
    } catch (err: unknown) {
      // Attempt token refresh on 401
      if (isAuthError(err)) {
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError
        // Retry once
        await fn()
        return
      }
      // Network error — register background sync
      if (isNetworkError(err)) {
        await this._registerBackgroundSync()
        return
      }
      throw err
    }
  }

  private async _registerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      // Background Sync API
      if ('sync' in reg) {
        await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
          .sync.register('push-pending-data')
      }
    } catch {
      // Background sync not supported — silently ignore
    }
  }

  private async _refreshPendingCount(): Promise<void> {
    let count = 0
    for (const tableName of SYNC_ORDER) {
      const table = getDbTable(tableName)
      if (INDEXED_SYNC_STATUS_TABLES.has(tableName)) {
        count += await table.where('syncStatus').equals('pending').count()
      } else {
        const all = await table.toArray()
        count += all.filter((r: Record<string, unknown>) => r.syncStatus === 'pending').length
      }
    }
    useSyncStore.getState().setPendingCount(count)
  }
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  return e.status === 401 || e.code === 'PGRST301' || String(e.message ?? '').includes('JWT')
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /fetch|network/i.test((err as TypeError).message)) return true
  return false
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const syncEngine = new SyncEngine()
