import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ChevronLeft, AlertCircle, Trash2 } from 'lucide-react'
import { useSyncStore } from '../../stores/sync-store'
import { syncEngine } from '../../core/sync/sync-engine'
import { db } from '../../core/database/db'
import { SYNC_ORDER, INDEXED_SYNC_STATUS_TABLES, type SyncTableName } from '../../core/sync/table-config'

// ── Per-table pending counts ──────────────────────────────────────────────────

type TableCounts = Partial<Record<SyncTableName, number>>

async function getTablePendingCounts(): Promise<TableCounts> {
  const counts: TableCounts = {}
  for (const tableName of SYNC_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[tableName]
    let count = 0
    if (INDEXED_SYNC_STATUS_TABLES.has(tableName)) {
      count = await table.where('syncStatus').equals('pending').count()
    } else {
      const all = await table.toArray()
      count = all.filter((r: Record<string, unknown>) => r.syncStatus === 'pending').length
    }
    if (count > 0) counts[tableName] = count
  }
  return counts
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(date: Date | null): string {
  if (!date) return 'Never'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  return `${Math.floor(diffHr / 24)} d ago`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SyncStatusPage() {
  const navigate = useNavigate()
  const status = useSyncStore((s) => s.status)
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const errors = useSyncStore((s) => s.errors)
  const conflicts = useSyncStore((s) => s.conflicts)
  const clearErrors = useSyncStore((s) => s.clearErrors)
  const loadConflicts = useSyncStore((s) => s.loadConflicts)
  const resolveConflict = useSyncStore((s) => s.resolveConflict)

  const [tableCounts, setTableCounts] = useState<TableCounts>({})

  useEffect(() => {
    loadConflicts()
    getTablePendingCounts().then(setTableCounts)
  }, [loadConflicts, pendingCount])

  const handleSyncNow = () => {
    syncEngine.fullSync().catch(console.error)
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Sync Status</h1>
          <button
            onClick={handleSyncNow}
            disabled={status === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Summary card */}
        <div className="card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <StatusBadge status={status} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Last sync</span>
            <span className="font-medium text-gray-800">{relativeTime(lastSyncTime)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pending records</span>
            <span className="font-medium text-gray-800">{pendingCount}</span>
          </div>
        </div>

        {/* Per-table counts */}
        {Object.keys(tableCounts).length > 0 && (
          <div className="card divide-y divide-gray-100">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pending by table
            </p>
            {(Object.entries(tableCounts) as [SyncTableName, number][]).map(([table, count]) => (
              <div key={table} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-gray-700 font-mono text-xs">{table}</span>
                <span className="font-medium text-yellow-700">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Unresolved conflicts */}
        {conflicts.length > 0 && (
          <div className="card">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              Conflicts ({conflicts.length})
            </p>
            <div className="divide-y divide-gray-100">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700">
                        {conflict.tableName} / {conflict.fieldName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">Record: {conflict.recordId}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="text-blue-600 font-medium mb-1">Local</p>
                      <p className="font-mono text-blue-800">{String(conflict.localValue)}</p>
                    </div>
                    <div className="bg-orange-50 rounded p-2">
                      <p className="text-orange-600 font-medium mb-1">Server</p>
                      <p className="font-mono text-orange-800">{String(conflict.remoteValue)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveConflict(conflict.id, conflict.localValue)}
                      className="flex-1 py-1.5 text-xs font-medium border border-blue-300 text-blue-700 rounded-lg"
                    >
                      Keep Mine
                    </button>
                    <button
                      onClick={() => resolveConflict(conflict.id, conflict.remoteValue)}
                      className="flex-1 py-1.5 text-xs font-medium border border-orange-300 text-orange-700 rounded-lg"
                    >
                      Keep Server
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error log */}
        {errors.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Errors ({errors.length})
              </p>
              <button
                onClick={clearErrors}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {[...errors].reverse().map((err) => (
                <div key={err.id} className="px-4 py-2 space-y-0.5">
                  <p className="text-xs text-red-700">{err.message}</p>
                  <p className="text-[10px] text-gray-400">{err.timestamp.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    idle: { cls: 'bg-green-100 text-green-700', label: 'Idle' },
    syncing: { cls: 'bg-blue-100 text-blue-700', label: 'Syncing…' },
    error: { cls: 'bg-red-100 text-red-700', label: 'Error' },
    offline: { cls: 'bg-gray-100 text-gray-600', label: 'Offline' },
  }
  const { cls, label } = map[status] ?? map.idle
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
  )
}
