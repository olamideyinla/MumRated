import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Phone } from 'lucide-react'
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns'
import { db } from '../../core/database/db'
import { useWorkerAttendanceHistory, usePayrollEntries } from '../../core/database/hooks/use-labor'
import type { AttendanceStatus } from '../../shared/types'

// ── Attendance dot colors ─────────────────────────────────────────────────────

function dotColor(status: AttendanceStatus | undefined): string {
  switch (status) {
    case 'present':  return 'bg-emerald-500'
    case 'absent':   return 'bg-red-400'
    case 'half_day': return 'bg-yellow-400'
    case 'leave':    return 'bg-blue-400'
    default:         return 'bg-gray-200'
  }
}

// ── Attendance grid (last 30 days) ────────────────────────────────────────────

function AttendanceGrid({
  workerId,
  from,
  to,
}: {
  workerId: string
  from: string
  to: string
}) {
  const records = useWorkerAttendanceHistory(workerId, from, to)
  const statusMap = new Map(records?.map(r => [r.date, r.status]))

  const days = eachDayOfInterval({
    start: parseISO(from),
    end:   parseISO(to),
  })

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const status  = statusMap.get(dateStr)
        return (
          <div
            key={dateStr}
            title={`${dateStr}: ${status ?? 'no record'}`}
            className={`w-5 h-5 rounded-md ${dotColor(status)}`}
          />
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkerDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const worker = useLiveQuery(async () => {
    if (!id) return null
    return db.workers.get(id) ?? null
  }, [id])

  const payrollEntries = usePayrollEntries(id)

  const today   = format(new Date(), 'yyyy-MM-dd')
  const from30  = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  const WAGE_LABELS: Record<string, string> = {
    daily: '/day', monthly: '/mo', hourly: '/hr', per_piece: '/pc',
  }

  if (worker === undefined) {
    return (
      <div className="h-dvh flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (worker === null) {
    return (
      <div className="h-dvh flex items-center justify-center text-gray-400 text-sm">
        Worker not found.
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1 truncate">{worker.name}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            worker.status === 'active' ? 'bg-emerald-500/20 text-white' : 'bg-white/20 text-white/70'
          }`}>
            {worker.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Profile</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Type</p>
              <p className="font-medium text-gray-800 capitalize">{worker.workerType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Wage</p>
              <p className="font-medium text-gray-800">
                ${worker.wageRate}{WAGE_LABELS[worker.wageType] ?? ''}
              </p>
            </div>
            {worker.startDate && (
              <div>
                <p className="text-xs text-gray-400">Started</p>
                <p className="font-medium text-gray-800">
                  {format(parseISO(worker.startDate), 'd MMM yyyy')}
                </p>
              </div>
            )}
            {worker.phone && (
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <p className="font-medium text-gray-800 flex items-center gap-1">
                  <Phone size={12} />
                  {worker.phone}
                </p>
              </div>
            )}
          </div>
          {worker.notes && (
            <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2">{worker.notes}</p>
          )}
        </div>

        {/* Attendance history */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Attendance — Last 30 Days</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Present</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Half Day</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Absent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Leave</span>
          </div>
          <AttendanceGrid workerId={worker.id} from={from30} to={today} />
        </div>

        {/* Payment history */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Payment History</p>
          {!payrollEntries || payrollEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No payments recorded yet</p>
          ) : (
            <div className="space-y-2">
              {payrollEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {entry.periodStart} → {entry.periodEnd}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.daysWorked} days worked
                      {entry.paymentDate ? ` · Paid ${format(parseISO(entry.paymentDate), 'd MMM yyyy')}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">${entry.netPay.toFixed(2)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      entry.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
