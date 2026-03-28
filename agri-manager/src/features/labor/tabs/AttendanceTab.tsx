import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useActiveWorkers, useAttendanceForDate } from '../../../core/database/hooks/use-labor'
import { newId, nowIso } from '../../../shared/types/base'
import type { AttendanceStatus, Worker } from '../../../shared/types'

// ── Status button config ──────────────────────────────────────────────────────

const STATUS_CONFIG: { status: AttendanceStatus; label: string; icon: string; active: string; inactive: string }[] = [
  {
    status: 'present',
    label: 'P',
    icon: '✓',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    inactive: 'bg-gray-50 text-gray-400 border-gray-200',
  },
  {
    status: 'half_day',
    label: '½',
    icon: '½',
    active: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    inactive: 'bg-gray-50 text-gray-400 border-gray-200',
  },
  {
    status: 'absent',
    label: 'A',
    icon: '✗',
    active: 'bg-red-100 text-red-700 border-red-300',
    inactive: 'bg-gray-50 text-gray-400 border-gray-200',
  },
  {
    status: 'leave',
    label: '🏖',
    icon: '🏖',
    active: 'bg-blue-100 text-blue-700 border-blue-300',
    inactive: 'bg-gray-50 text-gray-400 border-gray-200',
  },
]

// ── Worker row ─────────────────────────────────────────────────────────────────

function WorkerRow({
  worker,
  currentStatus,
  onStatusChange,
}: {
  worker: Worker
  currentStatus: AttendanceStatus | undefined
  onStatusChange: (status: AttendanceStatus) => Promise<void>
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
        <span className="text-primary-700 font-bold text-xs">
          {worker.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{worker.name}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {STATUS_CONFIG.map(cfg => (
          <button
            key={cfg.status}
            onClick={() => void onStatusChange(cfg.status)}
            className={`w-8 h-8 rounded-lg border text-xs font-semibold transition-colors ${
              currentStatus === cfg.status ? cfg.active : cfg.inactive
            }`}
          >
            {cfg.icon}
          </button>
        ))}
        <button
          onClick={() => navigate(`/labor/worker/${worker.id}`)}
          className="ml-1 text-xs text-primary-600 font-medium flex-shrink-0"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ── AttendanceTab ──────────────────────────────────────────────────────────────

export function AttendanceTab({ orgId }: { orgId: string }) {
  const userId  = useAuthStore(s => s.user?.id) ?? ''
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(todayStr)

  const workers     = useActiveWorkers(orgId, 'permanent')
  const attendanceMap = useAttendanceForDate(orgId, date)

  const handleStatusChange = async (worker: Worker, newStatus: AttendanceStatus) => {
    const existing = attendanceMap?.get(worker.id)
    const now = nowIso()
    if (existing) {
      // Toggle off if same status
      if (existing.status === newStatus) {
        await db.attendanceRecords.delete(existing.id)
      } else {
        await db.attendanceRecords.update(existing.id, {
          status: newStatus, updatedAt: now, syncStatus: 'pending',
        })
      }
    } else {
      await db.attendanceRecords.add({
        id: newId(), workerId: worker.id, date,
        status: newStatus, recordedBy: userId,
        createdAt: now, updatedAt: now, syncStatus: 'pending',
      })
    }
  }

  const presentCount  = workers?.filter(w => attendanceMap?.get(w.id)?.status === 'present').length ?? 0
  const halfCount     = workers?.filter(w => attendanceMap?.get(w.id)?.status === 'half_day').length ?? 0
  const recordedCount = attendanceMap?.size ?? 0
  const totalWorkers  = workers?.length ?? 0

  const isToday = date === todayStr

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Date navigator */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">
            {isToday ? 'Today' : format(parseISO(date), 'EEE, d MMM')}
          </p>
          <p className="text-xs text-gray-400">{format(parseISO(date), 'yyyy-MM-dd')}</p>
        </div>
        <button
          onClick={() => {
            const next = addDays(parseISO(date), 1)
            if (format(next, 'yyyy-MM-dd') <= todayStr) {
              setDate(format(next, 'yyyy-MM-dd'))
            }
          }}
          disabled={date >= todayStr}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary row */}
      <div className="mx-4 mt-3 flex gap-2">
        <div className="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-700">{presentCount + halfCount}</p>
          <p className="text-xs text-emerald-600">Present</p>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-gray-700">{totalWorkers - recordedCount}</p>
          <p className="text-xs text-gray-500">Not Recorded</p>
        </div>
        <div className="flex-1 bg-primary-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-primary-700">{totalWorkers}</p>
          <p className="text-xs text-primary-600">Total</p>
        </div>
      </div>

      {/* Workers list */}
      {workers === undefined && (
        <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
      )}

      {workers !== undefined && workers.length === 0 && (
        <div className="text-center mt-16 px-8">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-semibold text-gray-700">No permanent workers</p>
          <p className="text-xs text-gray-400 mt-1">Add workers in the Workers tab</p>
        </div>
      )}

      {workers !== undefined && workers.length > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex justify-end">
            <div className="flex gap-3 text-xs text-gray-400">
              <span>P=Present</span>
              <span>½=Half Day</span>
              <span>A=Absent</span>
            </div>
          </div>
          {workers.map(w => (
            <WorkerRow
              key={w.id}
              worker={w}
              currentStatus={attendanceMap?.get(w.id)?.status}
              onStatusChange={status => handleStatusChange(w, status)}
            />
          ))}
        </div>
      )}

      <div className="h-24" />
    </div>
  )
}
