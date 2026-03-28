import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Filter, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import { useAuditLogQuery, type AuditFilter } from '../../core/database/hooks/useAuditLog'
import type { AuditRecord } from '../../core/database/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  layerDailyRecords: 'layer record',
  broilerDailyRecords: 'broiler record',
  cattleDailyRecords: 'cattle record',
  fishDailyRecords: 'fish record',
  pigDailyRecords: 'pig record',
  rabbitDailyRecords: 'rabbit record',
  customAnimalDailyRecords: 'custom record',
  cropActivityRecords: 'crop activity',
  inventoryTransactions: 'inventory',
  inventoryItems: 'inventory item',
  financialTransactions: 'transaction',
  appUsers: 'team member',
  organizations: 'organization',
  farmLocations: 'farm location',
  infrastructures: 'infrastructure',
  enterpriseInstances: 'enterprise',
}

function actionColor(action: AuditRecord['action']): string {
  switch (action) {
    case 'create': return 'text-emerald-700 bg-emerald-50'
    case 'update': return 'text-blue-700 bg-blue-50'
    case 'delete': return 'text-red-700 bg-red-50'
  }
}

function relTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const navigate = useNavigate()
  const appUser = useAuthStore(s => s.appUser)
  const [showFilter, setShowFilter] = useState(false)
  const [filter, setFilter] = useState<AuditFilter>({})

  const members = useLiveQuery(async () => {
    if (!appUser) return []
    return db.appUsers.where('organizationId').equals(appUser.organizationId).toArray()
  }, [appUser?.organizationId])

  const logs = useAuditLogQuery(filter)

  const TABLE_NAMES = [
    'layerDailyRecords', 'broilerDailyRecords', 'cattleDailyRecords',
    'fishDailyRecords', 'pigDailyRecords', 'rabbitDailyRecords',
    'customAnimalDailyRecords', 'cropActivityRecords',
    'inventoryTransactions', 'financialTransactions', 'appUsers',
  ]

  const handleClearFilters = () => setFilter({})

  const hasFilters = Object.values(filter).some(v => v !== undefined && v !== '')

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Activity Log</h1>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${hasFilters ? 'bg-primary-100 text-primary-700' : 'border border-gray-300 text-gray-600'}`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</p>
            {hasFilters && (
              <button onClick={handleClearFilters} className="flex items-center gap-1 text-xs text-gray-400">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* User filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Team member</label>
              <select
                value={filter.userId ?? ''}
                onChange={e => setFilter(f => ({ ...f, userId: e.target.value || undefined }))}
                className="input text-sm"
              >
                <option value="">All members</option>
                {members?.map(m => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
              <select
                value={filter.action ?? ''}
                onChange={e => setFilter(f => ({ ...f, action: (e.target.value as AuditRecord['action']) || undefined }))}
                className="input text-sm"
              >
                <option value="">All actions</option>
                <option value="create">Created</option>
                <option value="update">Updated</option>
                <option value="delete">Deleted</option>
              </select>
            </div>

            {/* Table filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Record type</label>
              <select
                value={filter.tableName ?? ''}
                onChange={e => setFilter(f => ({ ...f, tableName: e.target.value || undefined }))}
                className="input text-sm"
              >
                <option value="">All types</option>
                {TABLE_NAMES.map(t => (
                  <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
              <input
                type="date"
                value={filter.fromDate ?? ''}
                onChange={e => setFilter(f => ({ ...f, fromDate: e.target.value || undefined }))}
                className="input text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Log list */}
      <div className="px-4 py-4">
        {!logs || logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-500 text-sm">{hasFilters ? 'No results for these filters' : 'No activity recorded yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(entry => {
              const tableLabel = TABLE_LABELS[entry.tableName] ?? entry.tableName
              return (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 shrink-0 ${actionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">{entry.userFullName}</span>
                        {' '}{entry.action}d{' '}
                        <span className="text-gray-500">{tableLabel}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{relTime(entry.timestamp)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
