import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useCasualLaborEntries } from '../../../core/database/hooks/use-labor'
import { newId, nowIso } from '../../../shared/types/base'
import type { CasualLaborEntry, PaymentMethod } from '../../../shared/types'

// ── CasualLaborSheet ──────────────────────────────────────────────────────────

function CasualLaborSheet({
  orgId,
  userId,
  onClose,
}: {
  orgId: string
  userId: string
  onClose: () => void
}) {
  const [date, setDate]               = useState(format(new Date(), 'yyyy-MM-dd'))
  const [activity, setActivity]       = useState('')
  const [numWorkers, setNumWorkers]   = useState('1')
  const [hours, setHours]             = useState('8')
  const [rate, setRate]               = useState('')
  const [method, setMethod]           = useState<PaymentMethod>('cash')
  const [paid, setPaid]               = useState(false)
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [enterprises, setEnterprises] = useState<{ id: string; name: string }[]>([])
  const [enterpriseId, setEnterpriseId] = useState('')

  useEffect(() => {
    const load = async () => {
      const user = await db.appUsers.get(userId)
      if (!user) return
      const locs = await db.farmLocations.where('organizationId').equals(user.organizationId).toArray()
      const locIds = new Set(locs.map(l => l.id))
      const infras = await db.infrastructures.toArray()
      const orgInfraIds = new Set(infras.filter(i => locIds.has(i.farmLocationId)).map(i => i.id))
      const instances = await db.enterpriseInstances
        .filter(e => orgInfraIds.has(e.infrastructureId) && e.status === 'active')
        .toArray()
      setEnterprises(instances.map(e => ({ id: e.id, name: e.name })))
    }
    void load()
  }, [userId])

  const nWorkers = parseInt(numWorkers) || 0
  const nHours   = parseFloat(hours) || 0
  const nRate    = parseFloat(rate) || 0
  const total    = nWorkers * nHours * nRate

  const METHODS: PaymentMethod[] = ['cash', 'bank', 'mobile_money', 'credit']

  const handleSave = async () => {
    if (!activity.trim()) { setError('Activity description is required'); return }
    if (nWorkers <= 0)     { setError('Number of workers must be > 0'); return }
    if (nHours <= 0)       { setError('Hours must be > 0'); return }
    if (nRate <= 0)        { setError('Rate must be > 0'); return }
    setSaving(true)
    setError(null)
    try {
      const now   = nowIso()
      const entId = enterpriseId || undefined
      const txnId = newId()

      // Financial transaction
      await db.financialTransactions.add({
        id: txnId, organizationId: orgId,
        enterpriseInstanceId: entId,
        date, type: 'expense', category: 'labor',
        amount: total, paymentMethod: method,
        notes: `Casual labor: ${activity.trim()}`,
        createdAt: now, updatedAt: now, syncStatus: 'pending',
      })

      // Casual labor entry
      const entry: CasualLaborEntry = {
        id: newId(), organizationId: orgId,
        date, enterpriseInstanceId: entId,
        activityDescription: activity.trim(),
        numberOfWorkers: nWorkers,
        hoursPerWorker: nHours,
        ratePerWorker: nRate,
        totalCost: total,
        paymentMethod: method,
        paid,
        recordedBy: userId,
        notes: notes.trim() || undefined,
        financialTransactionId: txnId,
        createdAt: now, updatedAt: now, syncStatus: 'pending',
      }
      await db.casualLaborEntries.add(entry)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Record Casual Labor</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* Enterprise (optional) */}
          {enterprises.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Enterprise (optional)</label>
              <select value={enterpriseId} onChange={e => setEnterpriseId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">— None —</option>
                {enterprises.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Activity */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Activity Description *</label>
            <input type="text" value={activity} onChange={e => setActivity(e.target.value)}
              placeholder="e.g. Weeding Field 2"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* Workers / Hours / Rate */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Workers *</label>
              <input type="number" value={numWorkers} onChange={e => setNumWorkers(e.target.value)}
                min="1" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hrs/Worker *</label>
              <input type="number" value={hours} onChange={e => setHours(e.target.value)}
                min="0.5" step="0.5" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rate/Worker *</label>
              <input type="number" value={rate} onChange={e => setRate(e.target.value)}
                min="0" step="0.01" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* Total cost display */}
          {total > 0 && (
            <div className="bg-primary-50 rounded-xl p-3 text-center">
              <p className="text-xs text-primary-600 font-medium">Total Cost</p>
              <p className="text-2xl font-bold text-primary-700">${total.toFixed(2)}</p>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                    method === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Paid toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-gray-700">Mark as Paid</p>
            <button
              onClick={() => setPaid(!paid)}
              className={`w-12 h-6 rounded-full transition-colors relative ${paid ? 'bg-emerald-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${paid ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Optional notes…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
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
            {saving ? 'Saving…' : 'Record Labor'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── CasualLaborTab ─────────────────────────────────────────────────────────────

export function CasualLaborTab({ orgId }: { orgId: string }) {
  const userId     = useAuthStore(s => s.user?.id) ?? ''
  const entries    = useCasualLaborEntries(orgId)
  const [showSheet, setShowSheet] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      {entries === undefined && (
        <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
      )}

      {entries !== undefined && entries.length === 0 && (
        <div className="text-center mt-16 px-8">
          <p className="text-4xl mb-3">🧑‍🌾</p>
          <p className="text-sm font-semibold text-gray-700">No casual labor recorded</p>
          <p className="text-xs text-gray-400 mt-1">Tap + to record a casual labor session</p>
        </div>
      )}

      {entries !== undefined && entries.length > 0 && (
        <div className="mx-4 mt-3 space-y-2">
          {entries.map(e => (
            <EntryCard key={e.id} entry={e} />
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
        <CasualLaborSheet orgId={orgId} userId={userId} onClose={() => setShowSheet(false)} />
      )}
    </div>
  )
}

function EntryCard({ entry }: { entry: CasualLaborEntry }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{entry.activityDescription}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {format(new Date(entry.date + 'T00:00:00'), 'd MMM yyyy')}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">${entry.totalCost.toFixed(2)}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            entry.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {entry.paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {entry.numberOfWorkers} workers × {entry.hoursPerWorker} hrs @ ${entry.ratePerWorker}/worker
      </p>
    </div>
  )
}
