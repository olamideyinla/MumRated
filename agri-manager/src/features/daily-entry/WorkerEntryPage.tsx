import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Flame } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import type { EnterpriseInstance } from '../../shared/types'

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  layers: '🥚', broilers: '🐔', cattle_dairy: '🐄', cattle_beef: '🐂',
  pigs_breeding: '🐷', pigs_growfinish: '🐖', fish: '🐟',
  crop_annual: '🌾', crop_perennial: '🌳', rabbit: '🐰', custom_animal: '🐾',
}

const TYPE_BG: Record<string, string> = {
  layers: 'bg-amber-100', broilers: 'bg-orange-100', cattle_dairy: 'bg-slate-100',
  cattle_beef: 'bg-stone-100', pigs_breeding: 'bg-pink-100', pigs_growfinish: 'bg-pink-100',
  fish: 'bg-blue-100', crop_annual: 'bg-lime-100', crop_perennial: 'bg-green-100',
  rabbit: 'bg-rose-100', custom_animal: 'bg-purple-100',
}

async function hasEntryToday(ent: EnterpriseInstance, date: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    case 'crop_perennial':  return false  // crop is event-based, not daily
    default:                return false
  }
}

/** Count consecutive days (going back from today) where worker has at least one entry */
async function calcStreak(userId: string): Promise<number> {
  const tables = [
    db.layerDailyRecords, db.broilerDailyRecords, db.cattleDailyRecords,
    db.fishDailyRecords, db.pigDailyRecords, db.rabbitDailyRecords,
    db.customAnimalDailyRecords, db.cropActivityRecords,
  ]

  // Collect all unique dates this user recorded data
  const datesSet = new Set<string>()
  for (const table of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (table as any).filter((r: any) => r.recordedBy === userId).toArray()
    for (const r of rows) datesSet.add(r.date as string)
  }

  // Count consecutive days from today backwards
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 366; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    if (!datesSet.has(iso)) break
    streak++
  }
  return streak
}

/** Count entries this month */
async function countThisMonth(userId: string): Promise<number> {
  const tables = [
    db.layerDailyRecords, db.broilerDailyRecords, db.cattleDailyRecords,
    db.fishDailyRecords, db.pigDailyRecords, db.rabbitDailyRecords,
    db.customAnimalDailyRecords, db.cropActivityRecords,
  ]
  const monthPrefix = new Date().toISOString().slice(0, 7) // YYYY-MM
  let count = 0
  for (const table of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (table as any)
      .filter((r: { recordedBy: string; date: string }) => r.recordedBy === userId && r.date.startsWith(monthPrefix))
      .count()
    count += rows
  }
  return count
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkerEntryPage() {
  const navigate = useNavigate()
  const appUser = useAuthStore(s => s.appUser)
  const today = new Date().toISOString().slice(0, 10)

  const data = useLiveQuery(async () => {
    if (!appUser) return null
    const assignedIds = appUser.assignedInfrastructureIds

    const enterprises = assignedIds.length > 0
      ? await db.enterpriseInstances
          .where('infrastructureId').anyOf(assignedIds)
          .filter(e => e.status === 'active')
          .toArray()
      : []

    const infras = await db.infrastructures.bulkGet(
      enterprises.map(e => e.infrastructureId),
    )
    const infraMap = Object.fromEntries(
      infras.filter(Boolean).map(i => [i!.id, i!.name]),
    )

    const withStatus = await Promise.all(
      enterprises.map(async e => ({
        enterprise: e,
        infraName: infraMap[e.infrastructureId] ?? '',
        done: await hasEntryToday(e, today),
      })),
    )

    const [streak, monthCount] = await Promise.all([
      calcStreak(appUser.id),
      countThisMonth(appUser.id),
    ])

    return { items: withStatus, streak, monthCount }
  }, [appUser?.id, today])

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  const { items, streak, monthCount } = data
  const pendingItems = items.filter(i => !i.done)
  const allDone = items.length > 0 && pendingItems.length === 0

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-safe-top pb-4">
        <p className="text-white/70 text-xs font-medium mt-2">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-white text-xl font-bold mt-0.5">
          {allDone ? 'All done today! ✓' : `Hi, ${appUser?.fullName.split(' ')[0] ?? 'there'}`}
        </h1>

        {/* Stats row */}
        <div className="flex gap-4 mt-3">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
              <Flame className="w-3.5 h-3.5 text-orange-300" />
              <span className="text-white text-xs font-semibold">
                {streak} day{streak !== 1 ? 's' : ''} in a row
              </span>
            </div>
          )}
          {monthCount > 0 && (
            <div className="bg-white/10 rounded-full px-3 py-1">
              <span className="text-white text-xs font-semibold">
                {monthCount} entries this month
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="bg-primary-700 px-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${(items.filter(i => i.done).length / items.length) * 100}%` }}
              />
            </div>
            <span className="text-white/70 text-xs whitespace-nowrap">
              {items.filter(i => i.done).length}/{items.length} done
            </span>
          </div>
        </div>
      )}

      {/* Enterprise list */}
      <div className="flex-1 p-4 space-y-3">
        {items.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-gray-500 text-sm font-medium">No units assigned</p>
            <p className="text-gray-400 text-xs mt-1">Ask your manager to assign you to infrastructure units.</p>
          </div>
        )}

        {allDone && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center mb-4">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-emerald-800 font-semibold text-base">All entries complete!</p>
            <p className="text-emerald-600 text-sm mt-1">
              Great work today. Come back tomorrow.
            </p>
            {streak >= 3 && (
              <p className="text-orange-600 text-sm mt-2 font-medium">
                🔥 {streak} days in a row — keep it up!
              </p>
            )}
          </div>
        )}

        {/* Pending first, then done */}
        {[...items.filter(i => !i.done), ...items.filter(i => i.done)].map(({ enterprise: ent, infraName, done }) => (
          <button
            key={ent.id}
            onClick={() => navigate(`/daily-entry/${ent.id}?date=${today}`)}
            disabled={done}
            className={`w-full rounded-2xl border p-4 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98]
              ${done
                ? 'bg-gray-50 border-gray-100 opacity-60'
                : 'bg-white border-gray-200 shadow-sm'
              }`}
          >
            <div className={`w-12 h-12 rounded-2xl ${TYPE_BG[ent.enterpriseType] ?? 'bg-gray-100'} flex items-center justify-center text-2xl shrink-0`}>
              {TYPE_ICON[ent.enterpriseType] ?? '🐾'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm leading-tight ${done ? 'text-gray-400' : 'text-gray-900'}`}>
                {ent.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{infraName}</p>
            </div>
            {done ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full shrink-0">
                <Clock className="w-3 h-3" />
                Enter
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
