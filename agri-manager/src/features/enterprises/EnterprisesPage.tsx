import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronRight, PlusCircle } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import { useWizardStore } from '../farm-setup/wizard-store'
import { db } from '../../core/database/db'
import type { EnterpriseType } from '../../shared/types'

const TYPE_LABEL: Record<EnterpriseType, string> = {
  layers: 'Layers', broilers: 'Broilers', cattle_dairy: 'Dairy Cattle',
  cattle_beef: 'Beef Cattle', pigs_breeding: 'Pigs (Breeding)',
  pigs_growfinish: 'Pigs (Grow/Finish)', fish: 'Fishery',
  crop_annual: 'Annual Crop', crop_perennial: 'Perennial Crop',
  rabbit: 'Rabbits', custom_animal: 'Custom Animal',
}

const TYPE_ICON: Record<EnterpriseType, string> = {
  layers: '🥚', broilers: '🐔', cattle_dairy: '🐄', cattle_beef: '🐂',
  pigs_breeding: '🐷', pigs_growfinish: '🐖', fish: '🐟',
  crop_annual: '🌾', crop_perennial: '🌳', rabbit: '🐰', custom_animal: '🐾',
}

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  planned:   'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

function durationLabel(startDate: string, endDate?: string | null): string {
  const from = new Date(startDate)
  const to   = endDate ? new Date(endDate) : new Date()
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
  if (days < 7)  return `${days}d`
  if (days < 60) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

type Filter = 'active' | 'completed' | 'all'

export default function EnterprisesPage() {
  const navigate    = useNavigate()
  const [filter, setFilter] = useState<Filter>('active')
  const userId      = useAuthStore(s => s.user?.id)
  const appUser     = useAuthStore(s => s.appUser)
  const resetWizard = useWizardStore(s => s.reset)
  const canManage   = appUser?.role === 'owner' || appUser?.role === 'manager'

  const handleUpdateFarm = () => {
    resetWizard()
    navigate('/farm-setup')
  }

  const enterprises = useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []
    const locations = await db.farmLocations
      .where('organizationId').equals(user.organizationId).toArray()
    const locIds = new Set(locations.map(l => l.id))
    const infras = await db.infrastructures
      .where('farmLocationId').anyOf([...locIds]).toArray()
    const infraIds = new Set(infras.map(i => i.id))
    const all = await db.enterpriseInstances
      .where('infrastructureId').anyOf([...infraIds]).toArray()
    return all.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return b.startDate.localeCompare(a.startDate)
    })
  }, [userId])

  const filtered = enterprises?.filter(e => {
    if (filter === 'active') return e.status === 'active' || e.status === 'planned'
    if (filter === 'completed') return e.status === 'completed' || e.status === 'cancelled'
    return true
  })

  const activeCount = enterprises?.filter(e => e.status === 'active').length ?? 0

  return (
    <div className="min-h-dvh bg-gray-50 fade-in">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-safe-top pb-4">
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white -ml-2"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold leading-tight">Enterprises</h1>
            <p className="text-white/70 text-sm">
              {activeCount} active enterprise{activeCount !== 1 ? 's' : ''}
            </p>
          </div>
          {canManage && (
            <button
              onClick={handleUpdateFarm}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              <PlusCircle size={16} />
              Update Farm
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 pt-3 pb-2 flex gap-2">
        {([
          { id: 'active',    label: 'Active' },
          { id: 'completed', label: 'Closed' },
          { id: 'all',       label: 'All' },
        ] as { id: Filter; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-4 py-2 space-y-2 pb-8">
        {!enterprises ? (
          <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
        ) : filtered?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center py-12">
            <p className="text-3xl mb-2">🐓</p>
            <p className="text-sm font-semibold text-gray-700">No enterprises found</p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === 'active'
                ? 'Complete the farm setup to add enterprises.'
                : 'No enterprises match this filter.'}
            </p>
            {filter === 'active' && (
              <button
                onClick={() => navigate('/farm-setup')}
                className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl"
              >
                Go to Farm Setup
              </button>
            )}
          </div>
        ) : (
          filtered?.map(e => (
            <button
              key={e.id}
              onClick={() => navigate(`/enterprises/${e.id}`)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            >
              <span className="text-3xl shrink-0">{TYPE_ICON[e.enterpriseType]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">{e.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLE[e.status] ?? ''}`}>
                    {e.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABEL[e.enterpriseType]}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {e.currentStockCount.toLocaleString()} · {durationLabel(e.startDate, e.actualEndDate)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
