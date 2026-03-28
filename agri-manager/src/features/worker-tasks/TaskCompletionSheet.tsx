import { useState } from 'react'
import { X } from 'lucide-react'
import { db } from '../../core/database/db'
import { useAuthStore } from '../../stores/auth-store'
import { nowIso } from '../../shared/types/base'
import { recalculateChecklistCompletion } from '../../core/services/checklist-generator'
import type { DailyTask } from '../../shared/types'

const SKIP_REASONS = [
  'Not applicable today',
  'No supplies available',
  'Already done by someone else',
  'Other',
]

interface Props {
  task: DailyTask
  onClose: () => void
  onCompleted?: () => void
}

export function TaskCompletionSheet({ task, onClose, onCompleted }: Props) {
  const userId  = useAuthStore(s => s.userId) ?? ''
  const [notes, setNotes]         = useState('')
  const [showSkip, setShowSkip]   = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [saving, setSaving]       = useState(false)

  const handleComplete = async () => {
    setSaving(true)
    try {
      await db.dailyTasks.update(task.id, {
        status: 'completed',
        completedAt: nowIso(),
        completedBy: userId,
        notes: notes.trim() || null,
      })
      await recalculateChecklistCompletion(task.checklistId)
      onCompleted?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (!skipReason) return
    setSaving(true)
    try {
      await db.dailyTasks.update(task.id, {
        status: 'skipped',
        completedAt: nowIso(),
        completedBy: userId,
        notes: `Skipped: ${skipReason}`,
      })
      await recalculateChecklistCompletion(task.checklistId)
      onCompleted?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const PRIORITY_COLORS: Record<string, string> = {
    required:    'text-red-600 bg-red-50',
    recommended: 'text-blue-600 bg-blue-50',
    optional:    'text-gray-500 bg-gray-50',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-semibold text-gray-900">{task.title}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority}
              </span>
            </div>
            {task.description && (
              <p className="text-sm text-gray-500 mt-1">{task.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!showSkip ? (
            <>
              {/* Notes input */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Add a note <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Note anything unusual…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              {/* Complete button */}
              <button
                onClick={() => void handleComplete()}
                disabled={saving}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-60 hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
              >
                {saving ? 'Saving…' : '✓ Mark as Complete'}
              </button>

              {/* Skip link */}
              <button
                onClick={() => setShowSkip(true)}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1"
              >
                Skip this task
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Why are you skipping?</p>
              <div className="space-y-2">
                {SKIP_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setSkipReason(reason)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                      skipReason === reason
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSkip(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => void handleSkip()}
                  disabled={!skipReason || saving}
                  className="flex-1 py-3 rounded-2xl bg-gray-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-gray-600 transition-colors"
                >
                  Confirm Skip
                </button>
              </div>
            </>
          )}
        </div>
        <div className="h-safe-bottom" />
      </div>
    </>
  )
}
