import { useState } from 'react'
import { Download } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, subMonths,
} from 'date-fns'
import Papa from 'papaparse'
import { useActiveWorkers, usePayrollEntriesForPeriod } from '../../../core/database/hooks/use-labor'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import { PayWorkerSheet } from '../sheets/PayWorkerSheet'
import type { Worker, AttendanceRecord, PayrollEntry } from '../../../shared/types'

// ── Wage calculation ──────────────────────────────────────────────────────────

interface PayCalc {
  daysWorked: number
  basePay: number
  overtimePay: number
}

function calculateWorkerPay(
  worker: Worker,
  records: AttendanceRecord[],
  periodDays: number,
): PayCalc {
  const present   = records.filter(r => r.status === 'present').length
  const halfDay   = records.filter(r => r.status === 'half_day').length
  const daysWorked = present + halfDay * 0.5
  const totalOvertimeHours = records.reduce((s, r) => s + (r.overtimeHours ?? 0), 0)
  const totalHoursWorked   = records.reduce((s, r) => s + (r.hoursWorked ?? 8), 0)

  let basePay = 0
  switch (worker.wageType) {
    case 'daily':
      basePay = worker.wageRate * daysWorked
      break
    case 'monthly':
      basePay = periodDays > 0 ? worker.wageRate * (daysWorked / periodDays) : 0
      break
    case 'hourly':
      basePay = worker.wageRate * totalHoursWorked
      break
    case 'per_piece':
      basePay = 0
      break
  }

  const overtimePay = worker.wageType !== 'monthly' && totalOvertimeHours > 0
    ? totalOvertimeHours * (worker.wageRate / 8) * 1.5
    : 0

  return { daysWorked, basePay: Math.round(basePay * 100) / 100, overtimePay: Math.round(overtimePay * 100) / 100 }
}

// ── Period types ──────────────────────────────────────────────────────────────

type PeriodPreset = 'this_month' | 'last_month' | 'custom'

function getPeriodDates(preset: PeriodPreset, customFrom: string, customTo: string): { from: string; to: string; days: number } {
  const now = new Date()
  let from: Date, to: Date
  if (preset === 'this_month') { from = startOfMonth(now); to = endOfMonth(now) }
  else if (preset === 'last_month') { const lm = subMonths(now, 1); from = startOfMonth(lm); to = endOfMonth(lm) }
  else { from = new Date(customFrom); to = new Date(customTo) }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd'), days }
}

// ── Worker payroll row ────────────────────────────────────────────────────────

function WorkerPayrollRow({
  worker,
  orgId,
  periodFrom,
  periodTo,
  periodDays,
  existingEntry,
  onPay,
}: {
  worker: Worker
  orgId: string
  periodFrom: string
  periodTo: string
  periodDays: number
  existingEntry: PayrollEntry | undefined
  onPay: (worker: Worker, calc: PayCalc) => void
}) {
  const records = useLiveQuery(async () => {
    const all = await db.attendanceRecords
      .where('workerId').equals(worker.id)
      .filter(r => r.date >= periodFrom && r.date <= periodTo)
      .toArray()
    return all
  }, [worker.id, periodFrom, periodTo]) ?? []

  const calc = calculateWorkerPay(worker, records, periodDays)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{worker.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {calc.daysWorked}d worked · Base ${calc.basePay.toFixed(2)}
          {calc.overtimePay > 0 ? ` · OT +$${calc.overtimePay.toFixed(2)}` : ''}
          {existingEntry?.deductions ? ` · Ded -$${existingEntry.deductions.toFixed(2)}` : ''}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        {existingEntry?.status === 'paid' ? (
          <div>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
              ✓ Paid
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              {existingEntry.paymentDate
                ? format(new Date(existingEntry.paymentDate + 'T00:00:00'), 'd MMM')
                : ''}
            </p>
          </div>
        ) : (
          <button
            onClick={() => onPay(worker, calc)}
            className="text-xs bg-primary-600 text-white font-medium px-2.5 py-1.5 rounded-xl hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            Mark Paid
          </button>
        )}
      </div>
    </div>
  )
}

// ── PayrollTab ─────────────────────────────────────────────────────────────────

export function PayrollTab({ orgId }: { orgId: string }) {
  const [preset, setPreset]     = useState<PeriodPreset>('this_month')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo]     = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [payingWorker, setPayingWorker] = useState<{ worker: Worker; calc: PayCalc } | null>(null)

  const { from, to, days } = getPeriodDates(preset, customFrom, customTo)
  const workers   = useActiveWorkers(orgId) ?? []
  const permanent = workers.filter(w => w.workerType === 'permanent')
  const existing  = usePayrollEntriesForPeriod(orgId, from, to) ?? []

  const existingMap = new Map(existing.map(e => [e.workerId, e]))

  const handleExportCsv = () => {
    const rows = permanent.map(w => {
      const records: AttendanceRecord[] = [] // will be computed client-side without hook
      const e = existingMap.get(w.id)
      return {
        Name: w.name,
        Period: `${from} to ${to}`,
        Days: e?.daysWorked ?? 0,
        'Base Pay': e?.basePay ?? 0,
        'Overtime Pay': e?.overtimePay ?? 0,
        Deductions: e?.deductions ?? 0,
        'Net Pay': e?.netPay ?? 0,
        Status: e?.status ?? 'pending',
      }
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `payroll_${from}_${to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const PRESETS: { id: PeriodPreset; label: string }[] = [
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom',     label: 'Custom' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Period selector */}
      <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Pay Period</p>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1 text-xs text-primary-600 font-medium"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
        <div className="flex gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
                preset === p.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        )}
      </div>

      {/* Payroll rows */}
      {permanent.length === 0 && (
        <div className="text-center mt-16 px-8">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-sm font-semibold text-gray-700">No permanent workers</p>
          <p className="text-xs text-gray-400 mt-1">Add permanent workers in the Workers tab</p>
        </div>
      )}

      {permanent.length > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {permanent.map(w => (
            <WorkerPayrollRow
              key={w.id}
              worker={w}
              orgId={orgId}
              periodFrom={from}
              periodTo={to}
              periodDays={days}
              existingEntry={existingMap.get(w.id)}
              onPay={(worker, calc) => setPayingWorker({ worker, calc })}
            />
          ))}
        </div>
      )}

      <div className="h-24" />

      {/* PayWorkerSheet */}
      {payingWorker && (
        <PayWorkerSheet
          worker={payingWorker.worker}
          orgId={orgId}
          periodStart={from}
          periodEnd={to}
          daysWorked={payingWorker.calc.daysWorked}
          basePay={payingWorker.calc.basePay}
          overtimePay={payingWorker.calc.overtimePay}
          onClose={() => setPayingWorker(null)}
        />
      )}
    </div>
  )
}
