import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Bell, TrendingUp, ShoppingCart, CreditCard, Package, BarChart3, CheckCircle, Clock, Stethoscope, Users2, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '../../stores/auth-store'
import { useEffectiveAppUser } from '../../shared/hooks/useEffectiveUser'
import { useUIStore } from '../../stores/ui-store'
import { db } from '../../core/database/db'
import { useTodayEntryStatus } from '../../core/database/hooks/use-daily-records'
import { useMonthlyFinancials } from '../../core/database/hooks/use-financials'
import { useUpcomingHealthEvents } from '../../core/database/hooks/use-health'
import { useTodayAttendanceSummary } from '../../core/database/hooks/use-labor'
import { useTeamDailyStatus } from '../../core/database/hooks/use-worker-tasks'
import { useCurrency } from '../../shared/hooks/useCurrency'
import type { EnterpriseType, EnterpriseInstance } from '../../shared/types'


// ── Greeting ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_ICON: Record<EnterpriseType, string> = {
  layers: '🥚', broilers: '🐔', cattle_dairy: '🐄', cattle_beef: '🐂',
  pigs_breeding: '🐷', pigs_growfinish: '🐖', fish: '🐟',
  crop_annual: '🌾', crop_perennial: '🌳', rabbit: '🐰', custom_animal: '🐾',
}

// ── Key metric extraction per type ────────────────────────────────────────────

function keyMetric(ent: EnterpriseInstance, latestRecord: any | null, dayOfCycle: number): string {
  const n = ent.currentStockCount

  switch (ent.enterpriseType) {
    case 'layers': {
      if (!latestRecord) return `Day ${dayOfCycle} — no data yet`
      const stock = n || 1
      const hdp = Math.round((latestRecord.totalEggs / stock) * 1000) / 10
      return `${hdp}% production`
    }
    case 'broilers':
      return latestRecord?.bodyWeightSampleAvg
        ? `${n.toLocaleString()} birds · ${latestRecord.bodyWeightSampleAvg} kg avg`
        : `${n.toLocaleString()} birds`
    case 'cattle_dairy':
      return latestRecord?.milkYieldLiters
        ? `${n.toLocaleString()} heads · ${latestRecord.milkYieldLiters} L milk`
        : `${n.toLocaleString()} heads`
    case 'cattle_beef':
      return `${n.toLocaleString()} heads`
    case 'fish':
      return `${n.toLocaleString()} fish`
    case 'pigs_breeding':
    case 'pigs_growfinish':
      return `${n.toLocaleString()} pigs`
    case 'rabbit':
      return `${n.toLocaleString()} rabbits`
    case 'custom_animal':
      return `${n.toLocaleString()} ${ent.breedOrVariety ?? 'animals'}`
    case 'crop_annual':
    case 'crop_perennial':
      return latestRecord?.growthStage
        ? `${latestRecord.growthStage} · Day ${dayOfCycle}`
        : `Day ${dayOfCycle}`
    default:
      return `Day ${dayOfCycle}`
  }
}

// ── Dashboard live data ───────────────────────────────────────────────────────

interface DashboardItem {
  enterprise: EnterpriseInstance
  dayOfCycle: number
  latestRecord: any
}

function useDashboardData(userId: string | undefined) {
  return useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null

    const org = await db.organizations.get(user.organizationId)
    const farmName = org?.name ?? 'Your Farm'

    const locations = await db.farmLocations.where('organizationId').equals(user.organizationId).toArray()
    const locationIds = new Set(locations.map(l => l.id))
    const allInfras = await db.infrastructures.toArray()
    const orgInfraIds = allInfras.filter(i => locationIds.has(i.farmLocationId)).map(i => i.id)

    if (orgInfraIds.length === 0) return { farmName, items: [], pendingSync: 0 }

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(orgInfraIds)
      .filter(e => e.status === 'active')
      .toArray()

    const getLatest = async (ent: EnterpriseInstance) => {
      const byTable = (table: any) =>
        table.where('enterpriseInstanceId').equals(ent.id).reverse().sortBy('date').then((r: any[]) => r[0] ?? null)
      switch (ent.enterpriseType) {
        case 'layers':          return byTable(db.layerDailyRecords)
        case 'broilers':        return byTable(db.broilerDailyRecords)
        case 'cattle_dairy':
        case 'cattle_beef':     return byTable(db.cattleDailyRecords)
        case 'fish':            return byTable(db.fishDailyRecords)
        case 'pigs_breeding':
        case 'pigs_growfinish': return byTable(db.pigDailyRecords)
        case 'rabbit':          return byTable(db.rabbitDailyRecords)
        case 'custom_animal':   return byTable(db.customAnimalDailyRecords)
        default:                return null
      }
    }

    const items: DashboardItem[] = await Promise.all(
      enterprises.map(async ent => {
        const latestRecord = await getLatest(ent)
        const dayOfCycle = Math.max(0, Math.floor((Date.now() - new Date(ent.startDate).getTime()) / 86_400_000))
        return { enterprise: ent, dayOfCycle, latestRecord }
      }),
    )

    const countPending = (table: any) => table.where('syncStatus').equals('pending').count() as Promise<number>
    const pendingCounts = await Promise.all([
      countPending(db.layerDailyRecords), countPending(db.broilerDailyRecords),
      countPending(db.cattleDailyRecords), countPending(db.fishDailyRecords),
      countPending(db.cropActivityRecords),
    ])
    const pendingSync = pendingCounts.reduce((s, n) => s + n, 0)

    return { farmName, items, pendingSync }
  }, [userId])
}

function useAlertCounts(userId: string | undefined) {
  return useLiveQuery(async () => {
    if (!userId) return { critical: 0, high: 0 }
    const alerts = await db.alerts
      .filter(a => !a.isDismissed && !a.isRead && (a.severity === 'critical' || a.severity === 'high'))
      .toArray()
    return {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high:     alerts.filter(a => a.severity === 'high').length,
    }
  }, [userId])
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SyncPill({ pendingSync, isOnline }: { pendingSync: number; isOnline: boolean }) {
  if (!isOnline) return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-200 text-gray-600 font-medium">Offline</span>
  )
  if (pendingSync === 0) return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
      <CheckCircle size={11} /> All synced
    </span>
  )
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
      ↑ {pendingSync} pending
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const userId   = useAuthStore(s => s.user?.id)
  const isOnline = useUIStore(s => s.isOnline)

  const data        = useDashboardData(userId)
  const alertCounts = useAlertCounts(userId)
  const entryStatus = useTodayEntryStatus()
  const { fmt }     = useCurrency()
  const appUser     = useEffectiveAppUser()
  const healthEvents = useUpcomingHealthEvents(appUser?.organizationId, 1)
  const attendanceSummary = useTodayAttendanceSummary(appUser?.organizationId)

  const now     = new Date()
  const isTeamRole = appUser?.role === 'owner' || appUser?.role === 'manager' || appUser?.role === 'supervisor'
  const teamTaskStatus = useTeamDailyStatus(isTeamRole ? appUser?.organizationId : undefined, format(now, 'yyyy-MM-dd'))
  const year    = now.getFullYear()
  const month   = now.getMonth() + 1
  const financials = useMonthlyFinancials(year, month)

  const totalAlerts    = (alertCounts?.critical ?? 0) + (alertCounts?.high ?? 0)
  const pendingEntries = entryStatus?.filter(s => !s.hasEntryToday) ?? []
  const dueHealthEvents = (healthEvents ?? []).filter(e => e.status === 'due_today' || e.status === 'overdue')
  const teamTaskAvgPct = teamTaskStatus && teamTaskStatus.length > 0
    ? Math.round(teamTaskStatus.reduce((s, w) => s + w.pct, 0) / teamTaskStatus.length)
    : null
  const teamTasksDoneCount = teamTaskStatus?.filter(w => w.pct === 100).length ?? 0

  return (
    <div className="h-full overflow-y-auto bg-gray-50 content-with-nav fade-in">
      {/* Greeting header */}
      <div className="bg-primary-600 px-4 pt-4 pb-5 safe-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/70 text-sm">{format(now, 'EEEE, d MMMM yyyy')}</p>
            <h1 className="text-white text-xl font-bold mt-0.5 leading-tight">
              {greeting()}, {appUser?.fullName.split(' ')[0] ?? '…'}
            </h1>
          </div>
          <SyncPill pendingSync={data?.pendingSync ?? 0} isOnline={isOnline} />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4 pb-4">
        {/* Alerts banner */}
        {totalAlerts > 0 && (
          <button
            onClick={() => navigate('/alerts')}
            className="w-full flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-3.5 active:bg-red-100 transition-colors text-left"
          >
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bell size={18} className="text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">
                {totalAlerts} alert{totalAlerts > 1 ? 's' : ''} need attention
              </p>
              <p className="text-xs text-red-500">
                {alertCounts?.critical ? `${alertCounts.critical} critical` : ''}
                {alertCounts?.critical && alertCounts.high ? ', ' : ''}
                {alertCounts?.high ? `${alertCounts.high} high priority` : ''}
              </p>
            </div>
            <span className="text-red-400 text-sm">→</span>
          </button>
        )}

        {/* Today's entry status */}
        {entryStatus !== undefined && entryStatus.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Today's Entries</p>
              {pendingEntries.length > 0 && (
                <button
                  onClick={() => navigate('/daily-entry')}
                  className="text-xs text-primary-600 font-semibold bg-primary-50 px-2.5 py-1 rounded-full active:bg-primary-100"
                >
                  Enter Data →
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {entryStatus.map(s => (
                <button
                  key={s.enterpriseId}
                  onClick={() => navigate(`/enterprises/${s.enterpriseId}`)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2.5 rounded-xl w-16 border transition-colors active:scale-95 ${
                    s.hasEntryToday ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <span className="text-2xl">{TYPE_ICON[s.enterpriseType]}</span>
                  <p className="text-xs font-medium text-gray-700 text-center leading-tight truncate w-full">
                    {s.enterpriseName.split(' ')[0]}
                  </p>
                  {s.hasEntryToday
                    ? <CheckCircle size={12} className="text-emerald-600" />
                    : <Clock size={12} className="text-amber-500" />
                  }
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enterprise key metrics */}
        {data?.items && data.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Enterprises</p>
            <div className="space-y-2">
              {data.items.map(({ enterprise, dayOfCycle, latestRecord }) => (
                <button
                  key={enterprise.id}
                  onClick={() => navigate(`/enterprises/${enterprise.id}`)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
                >
                  <span className="text-3xl flex-shrink-0">{TYPE_ICON[enterprise.enterpriseType]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium">{enterprise.name}</p>
                    <p className="text-base font-bold text-primary-700 leading-tight">
                      {keyMetric(enterprise, latestRecord, dayOfCycle)}
                    </p>
                  </div>
                  <TrendingUp size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {data !== undefined && data !== null && data.items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">🌱</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">No active enterprises</p>
            <p className="text-xs text-gray-400 mb-4">Complete farm setup to start tracking</p>
            <button onClick={() => navigate('/farm-setup')} className="btn-primary text-sm">
              Setup Farm
            </button>
          </div>
        )}

        {/* Financial snapshot */}
        {financials && (financials.income > 0 || financials.expenses > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">{format(now, 'MMMM')} Financials</p>
              <button onClick={() => navigate('/financials')} className="text-xs text-primary-600 font-medium">
                View details →
              </button>
            </div>
            <div className="flex items-stretch divide-x divide-gray-100">
              {[
                { label: 'Income',   value: financials.income,   color: 'text-emerald-600' },
                { label: 'Expenses', value: financials.expenses, color: 'text-red-500' },
                { label: 'Net',      value: financials.net,      color: financials.net >= 0 ? 'text-emerald-600' : 'text-red-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex-1 text-center px-2">
                  <p className={`text-lg font-bold ${color}`}>
                    {fmt(value)}
                  </p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance reminder card */}
        {attendanceSummary?.unrecorded && (
          <button
            onClick={() => navigate('/labor')}
            className="w-full flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-3.5 active:bg-orange-100 transition-colors text-left"
          >
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users2 size={18} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-700">Attendance not recorded</p>
              <p className="text-xs text-orange-500">
                {attendanceSummary.permanentCount} permanent worker{attendanceSummary.permanentCount !== 1 ? 's' : ''} pending
              </p>
            </div>
            <span className="text-orange-400 text-sm">→</span>
          </button>
        )}

        {/* Health alerts card */}
        {dueHealthEvents.length > 0 && (
          <button
            onClick={() => navigate('/health')}
            className="w-full flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-2xl p-3.5 active:bg-teal-100 transition-colors text-left"
          >
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Stethoscope size={18} className="text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-teal-700">
                Health Alerts <span className="bg-teal-600 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">{dueHealthEvents.length}</span>
              </p>
              <div className="mt-1 space-y-0.5">
                {dueHealthEvents.slice(0, 2).map(e => (
                  <p key={e.id} className="text-xs text-teal-600 truncate">○ {e.name}</p>
                ))}
              </div>
            </div>
            <span className="text-teal-400 text-sm">→</span>
          </button>
        )}

        {/* Team tasks card — visible to owner/manager/supervisor */}
        {isTeamRole && teamTaskStatus !== undefined && teamTaskStatus.length > 0 && (
          <button
            onClick={() => navigate('/team/tasks')}
            className="w-full flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 active:bg-indigo-100 transition-colors text-left"
          >
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClipboardList size={18} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-700">Team Tasks</p>
              <p className="text-xs text-indigo-500">
                {teamTaskAvgPct}% avg · {teamTasksDoneCount}/{teamTaskStatus.length} workers done
              </p>
            </div>
            <span className="text-indigo-400 text-sm">→</span>
          </button>
        )}

        {/* Quick actions */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <ShoppingCart size={20} />, label: 'Sale',      path: '/financials?type=sale' },
              { icon: <CreditCard size={20} />,   label: 'Expense',   path: '/financials?type=expense' },
              { icon: <Package size={20} />,      label: 'Inventory', path: '/inventory' },
              { icon: <BarChart3 size={20} />,    label: 'Reports',   path: '/reports' },
            ].map(({ icon, label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-3 px-2 shadow-sm active:scale-95 transition-transform"
              >
                <div className="text-primary-600">{icon}</div>
                <span className="text-xs font-medium text-gray-600">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
