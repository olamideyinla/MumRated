import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../core/database/db'
import { nowIso } from '../../shared/types/base'
import type { ScheduledHealthEvent } from '../../shared/types'

interface Props {
  event: ScheduledHealthEvent | null
  enterpriseName?: string
  onClose: () => void
}

export function CompleteEventSheet({ event, enterpriseName, onClose }: Props) {
  const [completedDate, setCompletedDate] = useState('')
  const [completedBy, setCompletedBy]     = useState('')
  const [batchNumber, setBatchNumber]     = useState('')
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)

  useEffect(() => {
    if (event) {
      setCompletedDate(new Date().toISOString().slice(0, 10))
      setCompletedBy('')
      setBatchNumber('')
      setNotes(event.notes ?? '')
    }
  }, [event])

  if (!event) return null

  const handleComplete = async () => {
    setSaving(true)
    try {
      await db.scheduledHealthEvents.update(event.id, {
        status: 'completed',
        completedDate: completedDate || new Date().toISOString().slice(0, 10),
        completedBy: completedBy || undefined,
        batchNumber: batchNumber || undefined,
        notes: notes || undefined,
        syncStatus: 'pending',
        updatedAt: nowIso(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setSaving(true)
    try {
      await db.scheduledHealthEvents.update(event.id, {
        status: 'skipped',
        notes: notes || undefined,
        syncStatus: 'pending',
        updatedAt: nowIso(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const scheduledLabel = (() => {
    try { return format(new Date(event.scheduledDate), 'd MMM yyyy') }
    catch { return event.scheduledDate }
  })()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[90dvh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900 leading-tight">{event.name}</p>
            {enterpriseName && (
              <p className="text-xs text-gray-500 mt-0.5">{enterpriseName}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">Scheduled: {scheduledLabel}</p>
            {event.product && (
              <p className="text-xs text-primary-600 mt-0.5">{event.product}{event.dosage ? ` · ${event.dosage}` : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2">
            <X size={18} />
          </button>
        </div>

        <div className="h-px bg-gray-100 mx-4" />

        {/* Form */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Completed Date
            </label>
            <input
              type="date"
              value={completedDate}
              onChange={e => setCompletedDate(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Completed By
            </label>
            <input
              type="text"
              value={completedBy}
              onChange={e => setCompletedBy(e.target.value)}
              placeholder="Name of person who administered"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Batch / Lot #
            </label>
            <input
              type="text"
              value={batchNumber}
              onChange={e => setBatchNumber(e.target.value)}
              placeholder="Vaccine or medicine batch number"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any observations or notes…"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-6 pt-1 flex gap-3">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-600 active:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleComplete}
            disabled={saving}
            className="flex-[2] py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold active:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Mark as Complete'}
          </button>
        </div>
      </div>
    </>
  )
}
