import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Check } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import { useTaskTemplates } from '../../../core/database/hooks/use-worker-tasks'
import { db } from '../../../core/database/db'
import { newId, nowIso } from '../../../shared/types/base'
import { useLiveQuery } from 'dexie-react-hooks'
import type {
  TaskTemplate, TimeWindow, TaskPriority, TemplateFrequency, TemplateCategory,
} from '../../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_WINDOWS: TimeWindow[]           = ['morning', 'midday', 'evening', 'anytime']
const PRIORITIES: TaskPriority[]           = ['required', 'recommended', 'optional']
const FREQUENCIES: TemplateFrequency[]     = ['daily', 'weekdays_only', 'specific_days']
const CATEGORIES: TemplateCategory[]       = ['feeding', 'cleaning', 'maintenance', 'observation', 'security', 'other']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Template form state ────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  category: TemplateCategory
  timeWindow: TimeWindow
  priority: TaskPriority
  frequency: TemplateFrequency
  specificDays: number[]
  isActive: boolean
}

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  category: 'other',
  timeWindow: 'morning',
  priority: 'recommended',
  frequency: 'daily',
  specificDays: [],
  isActive: true,
}

// ── AddTemplateSheet ──────────────────────────────────────────────────────────

function AddTemplateSheet({
  orgId,
  editing,
  onClose,
}: {
  orgId: string
  editing: TaskTemplate | null
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          title: editing.title,
          description: editing.description ?? '',
          category: editing.category,
          timeWindow: editing.timeWindow,
          priority: editing.priority,
          frequency: editing.frequency,
          specificDays: editing.specificDays ?? [],
          isActive: editing.isActive,
        }
      : DEFAULT_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = <K extends keyof FormState>(k: K) =>
    (v: FormState[K]) => setForm(p => ({ ...p, [k]: v }))

  const toggleDay = (d: number) =>
    setForm(p => ({
      ...p,
      specificDays: p.specificDays.includes(d) ? p.specificDays.filter(x => x !== d) : [...p.specificDays, d],
    }))

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (form.frequency === 'specific_days' && form.specificDays.length === 0) {
      setError('Select at least one day'); return
    }
    setSaving(true)
    try {
      const base = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        timeWindow: form.timeWindow,
        priority: form.priority,
        frequency: form.frequency,
        specificDays: form.frequency === 'specific_days' ? form.specificDays : null,
        isActive: form.isActive,
        updatedAt: nowIso(),
        syncStatus: 'pending' as const,
      }
      if (editing) {
        await db.taskTemplates.update(editing.id, base)
      } else {
        await db.taskTemplates.add({
          ...base,
          id: newId(),
          organizationId: orgId,
          infrastructureId: null,
          enterpriseTypes: [],
          assignedWorkerIds: null,
          createdAt: nowIso(),
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Edit Task Template' : 'New Task Template'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Task Title *</label>
            <input
              value={form.title}
              onChange={e => f('title')(e.target.value)}
              placeholder="e.g. Clean water troughs"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => f('description')(e.target.value)}
              rows={2}
              placeholder="Additional instructions…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => f('category')(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border capitalize transition-colors ${
                    form.category === c
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Time window */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Time Window</label>
            <div className="flex gap-2">
              {TIME_WINDOWS.map(w => (
                <button
                  key={w}
                  onClick={() => f('timeWindow')(w)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border capitalize transition-colors ${
                    form.timeWindow === w
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => f('priority')(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border capitalize transition-colors ${
                    form.priority === p
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Frequency</label>
            <div className="flex gap-2">
              {FREQUENCIES.map(fr => (
                <button
                  key={fr}
                  onClick={() => f('frequency')(fr)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    form.frequency === fr
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {fr === 'daily' ? 'Every Day' : fr === 'weekdays_only' ? 'Weekdays' : 'Custom'}
                </button>
              ))}
            </div>

            {form.frequency === 'specific_days' && (
              <div className="flex gap-1.5 mt-2.5">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      form.specificDays.includes(idx)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {label.charAt(0)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Active</span>
            <button
              onClick={() => f('isActive')(!form.isActive)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                form.isActive ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                form.isActive ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-bold text-sm disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Template'}
          </button>
        </div>
        <div className="h-safe-bottom" />
      </div>
    </>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
}: {
  template: TaskTemplate
  onEdit: (t: TaskTemplate) => void
}) {
  const toggleActive = async () => {
    await db.taskTemplates.update(template.id, {
      isActive: !template.isActive,
      updatedAt: nowIso(),
      syncStatus: 'pending',
    })
  }

  const PRIORITY_COLOR: Record<TaskPriority, string> = {
    required: 'text-red-600 bg-red-50',
    recommended: 'text-blue-600 bg-blue-50',
    optional: 'text-gray-500 bg-gray-100',
  }

  const WINDOW_EMOJI: Record<TimeWindow, string> = {
    morning: '☀️', midday: '🌤️', evening: '🌙', anytime: '📋',
  }

  return (
    <div className={`bg-white rounded-xl border p-3 transition-opacity ${
      template.isActive ? 'border-gray-100 opacity-100' : 'border-dashed border-gray-200 opacity-60'
    }`}>
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0 mt-0.5">{WINDOW_EMOJI[template.timeWindow]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">{template.title}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${PRIORITY_COLOR[template.priority]}`}>
              {template.priority}
            </span>
          </div>
          {template.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{template.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1 capitalize">
            {template.category} ·{' '}
            {template.frequency === 'daily' ? 'Every day'
              : template.frequency === 'weekdays_only' ? 'Weekdays only'
              : `${template.specificDays?.length ?? 0} days/week`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => void toggleActive()}
            className={`w-10 h-5.5 h-6 rounded-full transition-colors relative ${
              template.isActive ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              template.isActive ? 'left-[18px]' : 'left-0.5'
            }`} />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="text-xs text-primary-600 font-semibold px-2 py-1 rounded-lg bg-primary-50"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TaskTemplatesPage() {
  const navigate = useNavigate()
  const appUser  = useAuthStore(s => s.appUser)
  const orgId    = appUser?.organizationId ?? ''

  const templates = useTaskTemplates(orgId)
  const [showSheet, setShowSheet] = useState(false)
  const [editing, setEditing] = useState<TaskTemplate | null>(null)

  // Group by time window for display
  const grouped = {
    morning: templates?.filter(t => t.timeWindow === 'morning') ?? [],
    midday:  templates?.filter(t => t.timeWindow === 'midday')  ?? [],
    evening: templates?.filter(t => t.timeWindow === 'evening') ?? [],
    anytime: templates?.filter(t => t.timeWindow === 'anytime') ?? [],
  }

  const openEdit = (t: TaskTemplate) => { setEditing(t); setShowSheet(true) }
  const closeSheet = () => { setShowSheet(false); setEditing(null) }

  const workers = useLiveQuery(async () => {
    if (!orgId) return []
    return db.appUsers.where('organizationId').equals(orgId)
      .filter(u => u.role === 'worker' && u.isActive)
      .toArray()
  }, [orgId])

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg">Task Templates</h1>
            <p className="text-white/70 text-xs">
              {workers?.length ?? 0} worker{workers?.length !== 1 ? 's' : ''} · {templates?.length ?? 0} templates
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowSheet(true) }}
            className="w-10 h-10 flex items-center justify-center text-white bg-white/20 rounded-xl"
          >
            <Plus size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {templates === undefined && (
          <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
        )}

        {templates !== undefined && templates.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm font-semibold text-gray-600">No task templates yet</p>
            <p className="text-xs mt-1">Create templates to auto-populate worker daily checklists</p>
            <button
              onClick={() => setShowSheet(true)}
              className="mt-4 bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              Add First Template
            </button>
          </div>
        )}

        {(['morning', 'midday', 'evening', 'anytime'] as TimeWindow[]).map(window => {
          const items = grouped[window]
          if (items.length === 0) return null
          const emoji = { morning: '☀️', midday: '🌤️', evening: '🌙', anytime: '📋' }[window]
          return (
            <div key={window}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {emoji} {window === 'anytime' ? 'Any Time' : window.charAt(0).toUpperCase() + window.slice(1)}
              </p>
              <div className="space-y-2">
                {items.map(t => (
                  <TemplateCard key={t.id} template={t} onEdit={openEdit} />
                ))}
              </div>
            </div>
          )
        })}

        <div className="h-6" />
      </div>

      {/* Info note */}
      {templates !== undefined && templates.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Tip:</span> Templates are added to worker checklists when new daily checklists are generated. Changes apply from the next checklist generation.
            </p>
          </div>
        </div>
      )}

      {showSheet && (
        <AddTemplateSheet orgId={orgId} editing={editing} onClose={closeSheet} />
      )}

      {/* FAB */}
      {!showSheet && templates !== undefined && templates.length > 0 && (
        <button
          onClick={() => { setEditing(null); setShowSheet(true) }}
          className="fixed bottom-6 right-4 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center z-30"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  )
}
