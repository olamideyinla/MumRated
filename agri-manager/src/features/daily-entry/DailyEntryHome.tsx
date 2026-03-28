import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Plus, ShoppingCart, CreditCard, Package, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { db } from '../../core/database/db'
import { useEntryStore } from './entry-store'
import { QuickDateBar } from '../../shared/components/entry/QuickDateBar'
import type { EnterpriseType, EnterpriseInstance, Infrastructure } from '../../shared/types'
import type { AnyDailyRecord } from '../../core/database/hooks/use-daily-records'

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<EnterpriseType, { icon: string; bg: string; color: string }> = {
  layers:          { icon: '🥚', bg: 'bg-amber-100',   color: 'text-amber-700' },
  broilers:        { icon: '🐔', bg: 'bg-orange-100',  color: 'text-orange-700' },
  cattle_dairy:    { icon: '🐄', bg: 'bg-slate-100',   color: 'text-slate-700' },
  cattle_beef:     { icon: '🐂', bg: 'bg-stone-100',   color: 'text-stone-700' },
  pigs_breeding:   { icon: '🐷', bg: 'bg-pink-100',    color: 'text-pink-700' },
  pigs_growfinish: { icon: '🐖', bg: 'bg-pink-100',    color: 'text-pink-700' },
  fish:            { icon: '🐟', bg: 'bg-blue-100',    color: 'text-blue-700' },
  crop_annual:     { icon: '🌾', bg: 'bg-lime-100',    color: 'text-lime-700' },
  crop_perennial:  { icon: '🌳', bg: 'bg-green-100',   color: 'text-green-700' },
  rabbit:          { icon: '🐰', bg: 'bg-rose-100',    color: 'text-rose-700' },
  custom_animal:   { icon: '🐾', bg: 'bg-purple-100',  color: 'text-purple-700' },
}

// ── Helper: check if an entry exists for a given enterprise + date ─────────────

async function checkHasEntry(ent: EnterpriseInstance, date: string): Promise<boolean> {
  const check = (table: any) =>
    table.where('[enterpriseInstanceId+date]').equals([ent.id, date]).count().then((n: number) => n > 0)

  switch (ent.enterpriseType) {
    case 'layers':          return check(db.layerDailyRecords)
    case 'broilers':        return check(db.broilerDailyRecords)
    case 'cattle_dairy':
    case 'cattle_beef':     return check(db.cattleDailyRecords)
    case 'fish':            return check(db.fishDailyRecords)
    case 'pigs_breeding':
    case 'pigs_growfinish': return check(db.pigDailyRecords)
    case 'rabbit':          return check(db.rabbitDailyRecords)
    case 'custom_animal':   return check(db.customAnimalDailyRecords)
    case 'crop_annual':
    case 'crop_perennial':
      return db.cropActivityRecords
        .where('enterpriseInstanceId').equals(ent.id)
        .filter(r => r.date === date).count().then((n: number) => n > 0)
    default: return false
  }
}

// ── Helper: load the latest record for any enterprise ─────────────────────────

async function loadLatestRecord(ent: EnterpriseInstance): Promise<AnyDailyRecord | null> {
  const getLatest = async (table: any) => {
    const rows = await table.where('enterpriseInstanceId').equals(ent.id).reverse().sortBy('date')
    return rows[0] ?? null
  }
  switch (ent.enterpriseType) {
    case 'layers':          return getLatest(db.layerDailyRecords)
    case 'broilers':        return getLatest(db.broilerDailyRecords)
    case 'cattle_dairy':
    case 'cattle_beef':     return getLatest(db.cattleDailyRecords)
    case 'fish':            return getLatest(db.fishDailyRecords)
    case 'pigs_breeding':
    case 'pigs_growfinish': return getLatest(db.pigDailyRecords)
    case 'rabbit':          return getLatest(db.rabbitDailyRecords)
    case 'custom_animal':   return getLatest(db.customAnimalDailyRecords)
    case 'crop_annual':
    case 'crop_perennial':
      return db.cropActivityRecords
        .where('enterpriseInstanceId').equals(ent.id).reverse().sortBy('date')
        .then((rows: any[]) => rows[0] ?? null)
    default: return null
  }
}

// ── Helper: format the latest record as a one-line preview ───────────────────

function formatPreview(ent: EnterpriseInstance, record: AnyDailyRecord | null): string | null {
  if (!record) return null
  const r = record as any
  switch (ent.enterpriseType) {
    case 'layers':          return `${r.totalEggs ?? 0} eggs · ${r.mortalityCount ?? 0} deaths`
    case 'broilers':        return `${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed`
    case 'cattle_dairy':
    case 'cattle_beef':     return r.milkYieldLiters ? `${r.milkYieldLiters} L milk` : `${r.deaths ?? 0} deaths`
    case 'fish':            return `${r.feedGivenKg ?? 0} kg feed · ${r.estimatedMortality ?? 0} mort.`
    case 'pigs_breeding':
    case 'pigs_growfinish': return `${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed`
    case 'rabbit':          return `${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed`
    case 'custom_animal':   return `${r.feedConsumedKg ?? 0} kg feed`
    case 'crop_annual':
    case 'crop_perennial':  return r.activityType ? r.activityType.replace('_', ' ') : null
    default: return null
  }
}

// ── FAB ───────────────────────────────────────────────────────────────────────

function QuickActionFab() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const isOnline = useUIStore(s => s.isOnline)

  const actions = [
    { icon: <ShoppingCart size={18} />, label: 'Record a Sale',     path: '/financials?type=sale' },
    { icon: <CreditCard size={18} />,   label: 'Record an Expense', path: '/financials?type=expense' },
    { icon: <Package size={18} />,      label: 'Stock Received',    path: '/inventory/receive' },
  ]

  return (
    <div className="fixed bottom-20 right-4 z-20 flex flex-col-reverse items-end gap-2">
      {open && actions.map(a => (
        <div key={a.label} className="flex items-center gap-2 fade-in">
          <span className="text-xs font-medium text-gray-700 bg-white shadow px-2 py-1 rounded-lg">
            {a.label}
          </span>
          <button
            onClick={() => { setOpen(false); navigate(a.path) }}
            className="w-11 h-11 bg-white shadow-md rounded-full flex items-center justify-center text-primary-600 active:scale-95 transition-transform"
          >
            {a.icon}
          </button>
        </div>
      ))}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-gray-700 rotate-45' : 'bg-primary-600'
        }`}
      >
        <Plus size={26} className="text-white" />
      </button>

      {/* Offline badge */}
      {!isOnline && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-white" />
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DailyEntryHome() {
  const navigate = useNavigate()
  const userId = useAuthStore(s => s.user?.id)
  const isOnline = useUIStore(s => s.isOnline)
  const { selectedDate, setDate } = useEntryStore()

  const homeData = useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []

    const locations = await db.farmLocations.where('organizationId').equals(user.organizationId).toArray()
    const locationIds = new Set(locations.map(l => l.id))
    const allInfras = await db.infrastructures.toArray()
    const orgInfras = allInfras.filter(i => locationIds.has(i.farmLocationId))
    const infraMap = Object.fromEntries(orgInfras.map(i => [i.id, i]))
    const orgInfraIds = orgInfras.map(i => i.id)

    if (orgInfraIds.length === 0) return []

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(orgInfraIds)
      .filter(e => e.status === 'active')
      .toArray()

    const results = await Promise.all(
      enterprises.map(async (ent) => {
        const infra: Infrastructure = infraMap[ent.infrastructureId]
        const [hasEntry, latestRecord] = await Promise.all([
          checkHasEntry(ent, selectedDate),
          loadLatestRecord(ent),
        ])
        return { enterprise: ent, infra, hasEntry, latestRecord }
      }),
    )
    return results
  }, [userId, selectedDate])

  const isCrop = (t: EnterpriseType) => t === 'crop_annual' || t === 'crop_perennial'
  const pendingCount = homeData?.filter(d => !d.hasEntry && !isCrop(d.enterprise.enterpriseType)).length ?? 0
  const doneCount = homeData?.filter(d => d.hasEntry).length ?? 0

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="bg-primary-600 px-4 pt-3 pb-3 flex items-center justify-between gap-2 safe-top">
        <QuickDateBar date={selectedDate} onChange={setDate} />

        <div className="flex items-center gap-2">
          {/* Grid view */}
          <button
            onClick={() => navigate('/daily-entry/grid')}
            className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform"
            title="Grid entry"
          >
            <LayoutGrid size={20} />
          </button>

          {/* Sync / online indicator */}
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-400'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Progress summary */}
      {homeData && homeData.length > 0 && (
        <div className="bg-primary-700 px-4 pb-3 flex gap-4 text-xs text-white/80">
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-emerald-400" />
            {doneCount} done
          </span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-amber-400" />
              {pendingCount} pending
            </span>
          )}
        </div>
      )}

      {/* Enterprise cards */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3 content-with-nav">
        {homeData === undefined && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading…
          </div>
        )}

        {homeData?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-gray-500 text-sm font-medium mb-1">No active enterprises</p>
            <p className="text-gray-400 text-xs">
              Complete farm setup to start tracking your data.
            </p>
          </div>
        )}

        {homeData?.map(({ enterprise: ent, infra, hasEntry, latestRecord }) => {
          const cfg = TYPE_CONFIG[ent.enterpriseType]
          const isCropType = isCrop(ent.enterpriseType)
          const preview = formatPreview(ent, latestRecord)

          return (
            <button
              key={ent.id}
              onClick={() => navigate(`/daily-entry/${ent.id}?date=${selectedDate}`)}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl ${cfg.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
                {cfg.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{ent.name}</p>
                <p className="text-xs text-gray-400 truncate">{infra?.name ?? ''}</p>
                {preview && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {latestRecord ? `Last: ${preview}` : preview}
                  </p>
                )}
              </div>

              {/* Status badge */}
              <div className="flex-shrink-0">
                {isCropType ? (
                  <span className="text-xs text-gray-400 font-medium">Event</span>
                ) : hasEntry ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle size={12} />
                    Done
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    <Clock size={12} />
                    Pending
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <QuickActionFab />
    </div>
  )
}
