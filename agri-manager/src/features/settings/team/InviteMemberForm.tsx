import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Share2, MessageCircle, Copy, Check } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import { supabase } from '../../../core/config/supabase'
import { db } from '../../../core/database/db'
import { newId, nowIso } from '../../../shared/types/base'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppUser, UserRole, FarmLocation, Infrastructure } from '../../../shared/types'
import { useAuditLog } from '../../../core/database/hooks/useAuditLog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  fullName: string
  phone: string
  email: string
  role: Exclude<UserRole, 'owner'>
  assignedFarmLocationIds: string[]
  assignedInfrastructureIds: string[]
}

const ROLE_OPTIONS: { value: Exclude<UserRole, 'owner'>; label: string; desc: string }[] = [
  { value: 'manager',    label: 'Manager',    desc: 'Full farm access, all data, financials, reports' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Create & update data for assigned units' },
  { value: 'worker',     label: 'Worker',     desc: 'Daily entry for assigned units only' },
  { value: 'viewer',     label: 'Viewer',     desc: 'Read-only access to data and reports' },
]

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => chars[b % chars.length])
    .join('')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InviteMemberForm() {
  const navigate = useNavigate()
  const appUser = useAuthStore(s => s.appUser)
  const { logCreate } = useAuditLog()

  const [form, setForm] = useState<FormState>({
    fullName: '', phone: '', email: '',
    role: 'worker',
    assignedFarmLocationIds: [],
    assignedInfrastructureIds: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [invited, setInvited] = useState<{ member: AppUser; code: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load org locations and their infrastructure
  const locations = useLiveQuery(async () => {
    if (!appUser) return []
    return db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray()
  }, [appUser?.organizationId])

  const infrastructures = useLiveQuery(async () => {
    if (!appUser || form.assignedFarmLocationIds.length === 0) return []
    return db.infrastructures
      .where('farmLocationId').anyOf(form.assignedFarmLocationIds)
      .toArray()
  }, [form.assignedFarmLocationIds])

  const toggleLocation = (id: string) => {
    setForm(f => {
      const next = f.assignedFarmLocationIds.includes(id)
        ? f.assignedFarmLocationIds.filter(x => x !== id)
        : [...f.assignedFarmLocationIds, id]
      // Clear infrastructure selections for removed locations
      return { ...f, assignedFarmLocationIds: next, assignedInfrastructureIds: [] }
    })
  }

  const toggleInfra = (id: string) => {
    setForm(f => ({
      ...f,
      assignedInfrastructureIds: f.assignedInfrastructureIds.includes(id)
        ? f.assignedInfrastructureIds.filter(x => x !== id)
        : [...f.assignedInfrastructureIds, id],
    }))
  }

  const handleSubmit = async () => {
    if (!appUser) return
    if (!form.fullName.trim()) { setError('Full name is required'); return }
    if (!form.phone.trim()) { setError('Phone number is required'); return }

    setSubmitting(true)
    setError(null)

    try {
      const inviteCode = generateInviteCode()
      const now = nowIso()
      const newMember: AppUser = {
        id: newId(),
        organizationId: appUser.organizationId,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        role: form.role,
        assignedFarmLocationIds: form.assignedFarmLocationIds,
        assignedInfrastructureIds: form.assignedInfrastructureIds,
        isActive: false, // Becomes active when they first sign in
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      }

      await db.appUsers.put(newMember)
      // Store invite code locally as fallback
      await db.syncMeta.put({
        tableName: `invite_${newMember.id}`,
        lastSyncedAt: inviteCode,
      })

      // Also push invite to Supabase so the worker can redeem it from their device
      const org = await db.organizations.get(appUser.organizationId)
      const { error: supabaseErr } = await supabase.from('team_invites').insert({
        invite_code:                 inviteCode,
        organization_id:             appUser.organizationId,
        org_name:                    org?.name ?? 'My Farm',
        org_currency:                org?.currency ?? 'USD',
        full_name:                   form.fullName.trim(),
        phone:                       form.phone.trim(),
        email:                       form.email.trim() || null,
        role:                        form.role,
        assigned_farm_location_ids:  form.assignedFarmLocationIds,
        assigned_infrastructure_ids: form.assignedInfrastructureIds,
        local_user_id:               newMember.id,
      })
      if (supabaseErr) {
        // Non-fatal — invite code is still stored locally; worker must be online to redeem
        console.warn('Could not sync invite to Supabase:', supabaseErr.message)
      }

      await logCreate('appUsers', newMember as unknown as Record<string, unknown>)
      setInvited({ member: newMember, code: inviteCode })
    } catch (e) {
      setError('Failed to create member. Please try again.')
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (invited) {
    const org = appUser?.organizationId ?? ''
    const msg = `Hi ${invited.member.fullName}! You've been added to our farm management team on AgriManagerX.\n\nYour invite code: *${invited.code}*\n\nTo get started:\n1. Download AgriManagerX\n2. On the welcome screen, tap *"Join with invite code"*\n3. Sign in with your phone number (${invited.member.phone})\n4. Enter the code above when prompted`
    const waUrl = `https://wa.me/${invited.member.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`

    const handleCopy = async () => {
      await navigator.clipboard.writeText(msg)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div className="min-h-dvh bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
          <div className="flex items-center gap-3 py-3">
            <button onClick={() => navigate('/team')} className="touch-target -ml-2">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Invitation Ready</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          <div className="card p-5 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Share2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{invited.member.fullName}</h2>
            <p className="text-sm text-gray-500 mt-1">Invite code</p>
            <p className="text-3xl font-mono font-bold text-primary-700 tracking-widest mt-2">
              {invited.code}
            </p>
          </div>

          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Share message</p>
            <p className="text-xs text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3">{msg}</p>
          </div>

          <div className="space-y-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] text-white rounded-2xl font-semibold text-sm"
            >
              <MessageCircle className="w-5 h-5" />
              Send via WhatsApp
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 text-gray-700 rounded-2xl font-semibold text-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
            <button
              onClick={() => navigate('/team')}
              className="w-full py-3 text-sm text-gray-500 text-center"
            >
              Back to Team
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Invite Member</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Personal info */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Member Info</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="John Banda"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+265 999 000 000"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="john@farm.com"
              className="input"
            />
          </div>
        </div>

        {/* Role */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</p>
          <div className="space-y-2">
            {ROLE_OPTIONS.map(({ value, label, desc }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                  ${form.role === value
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white'
                  }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={form.role === value}
                  onChange={() => setForm(f => ({ ...f, role: value }))}
                  className="mt-0.5 accent-primary-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Location assignment */}
        {locations && locations.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Assign to Locations {form.role === 'manager' ? '(optional)' : ''}
            </p>
            <div className="space-y-2">
              {locations.map(loc => (
                <label key={loc.id} className="flex items-center gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assignedFarmLocationIds.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-gray-700">{loc.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Infrastructure assignment */}
        {infrastructures && infrastructures.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Assign to Infrastructure Units
            </p>
            <div className="space-y-2">
              {infrastructures.map((infra: Infrastructure) => (
                <label key={infra.id} className="flex items-center gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assignedInfrastructureIds.includes(infra.id)}
                    onChange={() => toggleInfra(infra.id)}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-gray-700">{infra.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 bg-primary-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Invitation'}
        </button>
      </div>
    </div>
  )
}
