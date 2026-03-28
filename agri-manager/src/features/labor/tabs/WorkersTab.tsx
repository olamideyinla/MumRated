import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Phone, X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useWorkers } from '../../../core/database/hooks/use-labor'
import { newId, nowIso } from '../../../shared/types/base'
import type { Worker, WorkerType, WageType } from '../../../shared/types'

// ── AddWorkerSheet ─────────────────────────────────────────────────────────────

function AddWorkerSheet({
  orgId,
  userId,
  worker,
  onClose,
}: {
  orgId: string
  userId: string
  worker?: Worker
  onClose: () => void
}) {
  const [name, setName]               = useState(worker?.name ?? '')
  const [phone, setPhone]             = useState(worker?.phone ?? '')
  const [workerType, setWorkerType]   = useState<WorkerType>(worker?.workerType ?? 'permanent')
  const [wageType, setWageType]       = useState<WageType>(worker?.wageType ?? 'daily')
  const [wageRate, setWageRate]       = useState(String(worker?.wageRate ?? ''))
  const [startDate, setStartDate]     = useState(worker?.startDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes]             = useState(worker?.notes ?? '')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    const rate = parseFloat(wageRate)
    if (isNaN(rate) || rate <= 0) { setError('Wage rate must be greater than 0'); return }
    setSaving(true)
    setError(null)
    try {
      const now = nowIso()
      if (worker) {
        await db.workers.update(worker.id, {
          name: name.trim(), phone: phone.trim() || undefined,
          workerType, wageType, wageRate: rate,
          startDate: startDate || undefined,
          notes: notes.trim() || undefined,
          updatedAt: now, syncStatus: 'pending',
        })
      } else {
        await db.workers.add({
          id: newId(), organizationId: orgId,
          name: name.trim(), phone: phone.trim() || undefined,
          workerType, wageType, wageRate: rate,
          startDate: startDate || undefined,
          status: 'active',
          assignedEnterpriseIds: [],
          notes: notes.trim() || undefined,
          createdAt: now, updatedAt: now, syncStatus: 'pending',
          recordedBy: userId,
        } as Worker & { recordedBy: string })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save worker')
    } finally {
      setSaving(false)
    }
  }

  const WAGE_TYPES: { value: WageType; label: string }[] = [
    { value: 'daily',     label: 'Daily' },
    { value: 'monthly',   label: 'Monthly' },
    { value: 'hourly',    label: 'Hourly' },
    { value: 'per_piece', label: 'Per Piece' },
  ]

  const wageLabel = WAGE_TYPES.find(t => t.value === wageType)?.label.toLowerCase() ?? 'day'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {worker ? 'Edit Worker' : 'Add Worker'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Alice Kamau"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 0722 000 000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Worker type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Worker Type</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(['permanent', 'casual'] as WorkerType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setWorkerType(t)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                    workerType === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Wage type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Wage Type</label>
            <div className="flex flex-wrap gap-2">
              {WAGE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setWageType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    wageType === t.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wage rate */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Rate (per {wageLabel}) *
            </label>
            <input
              type="number" value={wageRate} onChange={e => setWageRate(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Optional notes…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-3 border-t border-gray-100">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            {saving ? 'Saving…' : worker ? 'Save Changes' : 'Add Worker'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── WorkersTab ─────────────────────────────────────────────────────────────────

export function WorkersTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate()
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const workers  = useWorkers(orgId)
  const [showSheet, setShowSheet]       = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | undefined>(undefined)

  // Sort: permanent first, then casual, alphabetical within groups
  const sorted = [...(workers ?? [])].sort((a, b) => {
    if (a.workerType !== b.workerType) return a.workerType === 'permanent' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const WAGE_LABELS: Record<string, string> = {
    daily: '/day', monthly: '/mo', hourly: '/hr', per_piece: '/pc',
  }

  const handleEdit = (w: Worker) => {
    setEditingWorker(w)
    setShowSheet(true)
  }

  const handleClose = () => {
    setShowSheet(false)
    setEditingWorker(undefined)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {workers === undefined && (
        <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
      )}

      {workers !== undefined && workers.length === 0 && (
        <div className="text-center mt-16 px-8">
          <p className="text-4xl mb-3">👷</p>
          <p className="text-sm font-semibold text-gray-700">No workers yet</p>
          <p className="text-xs text-gray-400 mt-1">Tap + to add your first worker</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {sorted.map(w => (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 font-bold text-sm">
                  {w.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{w.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {w.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">
                  {w.workerType} · {w.wageType} ${w.wageRate}{WAGE_LABELS[w.wageType] ?? ''}
                </p>
                {w.phone && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={10} />
                    {w.phone}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(w)}
                  className="text-xs text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => navigate(`/labor/worker/${w.id}`)}
                  className="p-1 text-gray-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-24" />

      {/* FAB */}
      <button
        onClick={() => setShowSheet(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-primary-700 transition-colors z-30"
      >
        <Plus size={24} />
      </button>

      {showSheet && (
        <AddWorkerSheet
          orgId={orgId}
          userId={userId}
          worker={editingWorker}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
