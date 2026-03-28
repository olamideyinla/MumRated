import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft, Save, Crown, ShieldCheck, Hammer, Users, Eye,
  ToggleLeft, ToggleRight, Trash2, AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import { db } from '../../../core/database/db'
import { nowIso } from '../../../shared/types/base'
import { useAuditLog } from '../../../core/database/hooks/useAuditLog'
import { useAuditLogQuery } from '../../../core/database/hooks/useAuditLog'
import type { UserRole } from '../../../shared/types'

// ── Config ────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'manager',    label: 'Manager',    desc: 'Full farm access, financials & reports' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Create & update data for assigned units' },
  { value: 'worker',     label: 'Worker',     desc: 'Daily entry for assigned units only' },
  { value: 'viewer',     label: 'Viewer',     desc: 'Read-only access to all data' },
]

const ROLE_ICONS: Record<UserRole, typeof Crown> = {
  owner: Crown, manager: ShieldCheck, supervisor: Hammer, worker: Users, viewer: Eye,
}
const ROLE_COLORS: Record<UserRole, string> = {
  owner:      'bg-amber-100 text-amber-800',
  manager:    'bg-blue-100 text-blue-800',
  supervisor: 'bg-purple-100 text-purple-800',
  worker:     'bg-green-100 text-green-800',
  viewer:     'bg-gray-100 text-gray-700',
}

const TABLE_LABELS: Record<string, string> = {
  layerDailyRecords: 'Layer record', broilerDailyRecords: 'Broiler record',
  cattleDailyRecords: 'Cattle record', fishDailyRecords: 'Fish record',
  pigDailyRecords: 'Pig record', rabbitDailyRecords: 'Rabbit record',
  customAnimalDailyRecords: 'Custom record', cropActivityRecords: 'Crop activity',
  inventoryTransactions: 'Inventory', financialTransactions: 'Transaction',
  appUsers: 'Team member', organizations: 'Organization', farmLocations: 'Farm location',
}

function relTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MemberDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.appUser)
  const { logUpdate } = useAuditLog()

  // ── Edit state ───────────────────────────────────────────────────────────────
  const [saving, setSaving]               = useState(false)
  const [editName, setEditName]           = useState<string | null>(null)
  const [editPhone, setEditPhone]         = useState<string | null>(null)
  const [editEmail, setEditEmail]         = useState<string | null>(null)
  const [editRole, setEditRole]           = useState<UserRole | null>(null)
  const [editLocations, setEditLocations] = useState<string[] | null>(null)
  const [editInfras, setEditInfras]       = useState<string[] | null>(null)

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]                   = useState(false)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const member = useLiveQuery(() => userId ? db.appUsers.get(userId) : undefined, [userId])
  const locations = useLiveQuery(async () => {
    if (!currentUser) return []
    return db.farmLocations.where('organizationId').equals(currentUser.organizationId).toArray()
  }, [currentUser?.organizationId])
  const infrastructures = useLiveQuery(async () => {
    const locIds = editLocations ?? member?.assignedFarmLocationIds ?? []
    if (locIds.length === 0) return []
    return db.infrastructures.where('farmLocationId').anyOf(locIds).toArray()
  }, [editLocations, member?.assignedFarmLocationIds])

  const activity = useAuditLogQuery(userId ? { userId } : undefined)

  if (!member) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-400 text-sm">
        {member === null ? 'Member not found' : 'Loading…'}
      </div>
    )
  }

  const isOwner  = member.role === 'owner'
  const canEdit  = currentUser?.role === 'owner' && !isOwner
  const RoleIcon = ROLE_ICONS[member.role]

  // Active values (edit draft or persisted)
  const activeName      = editName      ?? member.fullName
  const activePhone     = editPhone     ?? (member.phone ?? '')
  const activeEmail     = editEmail     ?? (member.email ?? '')
  const activeRole      = editRole      ?? member.role
  const activeLocations = editLocations ?? member.assignedFarmLocationIds
  const activeInfras    = editInfras    ?? member.assignedInfrastructureIds

  const isDirty = editName !== null || editPhone !== null || editEmail !== null
    || editRole !== null || editLocations !== null || editInfras !== null

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    const oldRecord = { ...member }
    const updated = {
      ...member,
      fullName:                  activeName.trim() || member.fullName,
      phone:                     activePhone.trim()  || undefined,
      email:                     activeEmail.trim()  || undefined,
      role:                      activeRole,
      assignedFarmLocationIds:   activeLocations,
      assignedInfrastructureIds: activeInfras,
      updatedAt:                 nowIso(),
      syncStatus:                'pending' as const,
    }
    await db.appUsers.put(updated)
    await logUpdate('appUsers', oldRecord as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
    setSaving(false)
    setEditName(null); setEditPhone(null); setEditEmail(null)
    setEditRole(null); setEditLocations(null); setEditInfras(null)
  }

  const handleToggleActive = async () => {
    if (!canEdit) return
    const old = { ...member }
    const updated = { ...member, isActive: !member.isActive, updatedAt: nowIso(), syncStatus: 'pending' as const }
    await db.appUsers.put(updated)
    await logUpdate('appUsers', old as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
  }

  const handleDelete = async () => {
    if (!canEdit || !userId) return
    setDeleting(true)
    try {
      await db.appUsers.delete(userId)
      navigate('/team', { replace: true })
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Member Detail</h1>
          {canEdit && isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── Profile card ──────────────────────────────────────────────────── */}
        <div className="card p-4 space-y-4">
          {/* Avatar + role badge */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-primary-700 font-bold text-xl">
                {(activeName || member.fullName).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {canEdit ? (
                <input
                  value={activeName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Full name"
                  className="input-base text-sm font-semibold"
                />
              ) : (
                <h2 className="text-base font-bold text-gray-900">{member.fullName}</h2>
              )}
            </div>
            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${ROLE_COLORS[member.role]}`}>
              <RoleIcon className="w-3 h-3" />
              {member.role}
            </span>
          </div>

          {/* Phone + Email */}
          {canEdit ? (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={activePhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="input-base text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="email"
                  value={activeEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="worker@example.com"
                  className="input-base text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {member.phone && <p className="text-sm text-gray-500">{member.phone}</p>}
              {member.email && <p className="text-sm text-gray-500">{member.email}</p>}
              {!member.phone && !member.email && <p className="text-sm text-gray-400">No contact info</p>}
            </div>
          )}

          {/* Active toggle */}
          {canEdit && (
            <button
              onClick={handleToggleActive}
              className="flex items-center justify-between w-full pt-3 border-t border-gray-100"
            >
              <div>
                <span className="text-sm font-medium text-gray-700">Active</span>
                <p className="text-xs text-gray-400">
                  {member.isActive ? 'Can sign in and submit data' : 'Blocked from signing in'}
                </p>
              </div>
              {member.isActive
                ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                : <ToggleLeft  className="w-7 h-7 text-gray-300" />
              }
            </button>
          )}
        </div>

        {/* ── Role ──────────────────────────────────────────────────────────── */}
        {canEdit && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</p>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                    ${activeRole === value ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={activeRole === value}
                    onChange={() => setEditRole(value)}
                    className="accent-primary-600 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Location assignments ───────────────────────────────────────────── */}
        {canEdit && locations && locations.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Locations</p>
            <div className="space-y-2">
              {locations.map(loc => (
                <label key={loc.id} className="flex items-center gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeLocations.includes(loc.id)}
                    onChange={() => {
                      const next = activeLocations.includes(loc.id)
                        ? activeLocations.filter(x => x !== loc.id)
                        : [...activeLocations, loc.id]
                      setEditLocations(next)
                      setEditInfras([])
                    }}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-gray-700">{loc.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Infrastructure assignments ─────────────────────────────────────── */}
        {canEdit && infrastructures && infrastructures.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Infrastructure</p>
            <div className="space-y-2">
              {infrastructures.map(infra => (
                <label key={infra.id} className="flex items-center gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeInfras.includes(infra.id)}
                    onChange={() => {
                      const next = activeInfras.includes(infra.id)
                        ? activeInfras.filter(x => x !== infra.id)
                        : [...activeInfras, infra.id]
                      setEditInfras(next)
                    }}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-gray-700">{infra.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Activity log ──────────────────────────────────────────────────── */}
        <div className="card">
          <p className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Recent Activity
          </p>
          {!activity || activity.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">No activity recorded.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.slice(0, 20).map(entry => {
                const tableLabel = TABLE_LABELS[entry.tableName] ?? entry.tableName
                return (
                  <div key={entry.id} className="px-4 py-2.5">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium capitalize">{entry.action}d</span>
                      {' '}<span className="text-gray-500">{tableLabel}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{relTime(entry.timestamp)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Remove member ─────────────────────────────────────────────────── */}
        {canEdit && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 text-red-600 text-sm font-medium bg-white active:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove Member
          </button>
        )}

        <div className="h-4" />
      </div>

      {/* ── Delete confirmation overlay ──────────────────────────────────────── */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-6 safe-bottom shadow-xl">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-3">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Remove {member.fullName}?</h3>
              <p className="text-sm text-gray-500 mt-1">
                They will immediately lose access to the farm. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium bg-white active:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold active:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
