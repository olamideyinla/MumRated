import { useState } from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { newId, nowIso } from '../../../shared/types/base'
import type { Worker, PaymentMethod } from '../../../shared/types'

interface PayWorkerSheetProps {
  worker: Worker
  orgId: string
  periodStart: string
  periodEnd: string
  daysWorked: number
  basePay: number
  overtimePay: number
  onClose: () => void
}

export function PayWorkerSheet({
  worker, orgId, periodStart, periodEnd,
  daysWorked, basePay, overtimePay, onClose,
}: PayWorkerSheetProps) {
  const userId      = useAuthStore(s => s.user?.id) ?? ''
  const [deductions, setDeductions] = useState('0')
  const [notes, setNotes]           = useState('')
  const [method, setMethod]         = useState<PaymentMethod>('cash')
  const [payDate, setPayDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const dedAmt  = parseFloat(deductions) || 0
  const netPay  = basePay + overtimePay - dedAmt

  const METHODS: PaymentMethod[] = ['cash', 'bank', 'mobile_money', 'credit']

  const handleConfirm = async () => {
    if (netPay < 0) { setError('Net pay cannot be negative'); return }
    setSaving(true)
    setError(null)
    try {
      const now   = nowIso()
      const txnId = newId()

      await db.transaction('rw', [db.payrollEntries, db.financialTransactions], async () => {
        await db.financialTransactions.add({
          id: txnId, organizationId: orgId,
          date: payDate, type: 'expense', category: 'labor',
          amount: netPay, paymentMethod: method,
          counterpartyId: worker.id,
          notes: notes.trim() || `Payroll: ${worker.name} ${periodStart}–${periodEnd}`,
          createdAt: now, updatedAt: now, syncStatus: 'pending',
        })

        await db.payrollEntries.add({
          id: newId(), workerId: worker.id,
          periodStart, periodEnd,
          daysWorked, basePay, overtimePay,
          deductions: dedAmt,
          netPay,
          paymentDate: payDate,
          paymentMethod: method,
          status: 'paid',
          notes: notes.trim() || undefined,
          financialTransactionId: txnId,
          createdAt: now, updatedAt: now, syncStatus: 'pending',
        })
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Pay {worker.name}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Period</span>
              <span className="font-medium text-gray-800">{periodStart} → {periodEnd}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Days Worked</span>
              <span className="font-medium text-gray-800">{daysWorked}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Base Pay</span>
              <span className="font-medium text-gray-800">${basePay.toFixed(2)}</span>
            </div>
            {overtimePay > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Overtime Pay</span>
                <span className="font-medium text-emerald-600">+${overtimePay.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Deductions */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Deductions</label>
            <input type="number" value={deductions} onChange={e => setDeductions(e.target.value)}
              min="0" step="0.01"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* Net pay display */}
          <div className={`rounded-xl p-3 text-center ${netPay >= 0 ? 'bg-primary-50' : 'bg-red-50'}`}>
            <p className="text-xs font-medium text-gray-600">Net Pay</p>
            <p className={`text-2xl font-bold ${netPay >= 0 ? 'text-primary-700' : 'text-red-600'}`}>
              ${netPay.toFixed(2)}
            </p>
          </div>

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

          {/* Payment date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-3 border-t border-gray-100">
          <button
            onClick={() => void handleConfirm()}
            disabled={saving || netPay < 0}
            className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            {saving ? 'Processing…' : `Confirm Payment $${netPay.toFixed(2)}`}
          </button>
        </div>
      </div>
    </>
  )
}
