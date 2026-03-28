import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend, Cell,
} from 'recharts'
import { useAuthStore } from '../../stores/auth-store'
import { useCurrency } from '../../shared/hooks/useCurrency'
import { db } from '../../core/database/db'
import { lohmannProductionPct, LOHMANN_FEED_KG_PER_BIRD_DAY } from '../../core/constants/breed-standards'

// ── Helpers ───────────────────────────────────────────────────────────────────

function weeksBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / (7 * 86400000)
}

const today = new Date().toISOString().slice(0, 10)

// ── Data loading ──────────────────────────────────────────────────────────────

function useLayerData() {
  const appUser = useAuthStore(s => s.appUser)
  return useLiveQuery(async () => {
    if (!appUser) return null
    const locs = await db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray()
    const infras = await db.infrastructures.where('farmLocationId').anyOf(locs.map(l => l.id)).toArray()
    const infraIds = infras.map(i => i.id)
    if (!infraIds.length) return null

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => e.enterpriseType === 'layers' && e.status === 'active')
      .toArray()

    const withRecords = await Promise.all(enterprises.map(async ent => {
      const records = await db.layerDailyRecords
        .where('enterpriseInstanceId').equals(ent.id)
        .reverse().sortBy('date')
      const last7 = records.slice(0, 7)
      const ageWeeks = weeksBetween(ent.startDate, today)
      const avgEggsPerDay = last7.length
        ? last7.reduce((s, r) => s + r.totalEggs, 0) / last7.length
        : 0
      const prodPct = ent.currentStockCount > 0 ? (avgEggsPerDay / ent.currentStockCount) * 100 : 0
      const avgFeedKg = last7.length
        ? last7.reduce((s, r) => s + r.feedConsumedKg, 0) / last7.length
        : LOHMANN_FEED_KG_PER_BIRD_DAY * ent.currentStockCount
      return { enterprise: ent, ageWeeks: Math.round(ageWeeks), prodPct: +prodPct.toFixed(1), avgFeedKgPerDay: +avgFeedKg.toFixed(2) }
    }))

    return withRecords
  }, [appUser?.organizationId])
}

// ── Weekly projection ─────────────────────────────────────────────────────────

interface WeekPoint {
  week: number
  label: string
  marginalProfit: number
  cumulative: number
}

function calcWeeklyProjection(params: {
  birds: number
  currentAgeWeeks: number
  currentProdPct: number
  dailyFeedKg: number
  feedCostPerKg: number
  eggPricePerUnit: number
  spentHenPricePerBird: number
  horizonWeeks: number
}): WeekPoint[] {
  const { birds, currentAgeWeeks, dailyFeedKg, feedCostPerKg, eggPricePerUnit, horizonWeeks } = params

  const feedCostPerWeek = dailyFeedKg * feedCostPerKg * 7
  let cumulative = 0

  return Array.from({ length: horizonWeeks }, (_, i) => {
    const w = i + 1
    const ageWeeks = currentAgeWeeks + w
    const prodPct = lohmannProductionPct(ageWeeks)
    const eggsThisWeek = (prodPct / 100) * birds * 7
    const eggRevenue = eggsThisWeek * eggPricePerUnit
    const marginalProfit = eggRevenue - feedCostPerWeek
    cumulative += marginalProfit
    return { week: w, label: `W${w}`, marginalProfit: +marginalProfit.toFixed(2), cumulative: +cumulative.toFixed(2) }
  })
}

function findOptimalDepletionWeek(points: WeekPoint[], spentHenValue: number, birds: number): number {
  let best = 0
  let bestValue = -Infinity
  points.forEach(p => {
    const totalValue = p.cumulative + spentHenValue * birds
    if (totalValue > bestValue) { bestValue = totalValue; best = p.week }
  })
  return best
}

// ── Input row ─────────────────────────────────────────────────────────────────

function InputRow({ label, value, onChange, step = 0.01, suffix = '' }: {
  label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number" value={value} min={0} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {suffix && <span className="text-xs text-gray-400 w-10">{suffix}</span>}
      </div>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, sym }: {
  active?: boolean; payload?: { value: number; name: string }[]; label?: string; sym: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className={p.name === 'cumulative' ? 'text-blue-600' : p.value >= 0 ? 'text-green-600' : 'text-red-500'}>
          {p.name === 'cumulative' ? 'Cumulative' : 'Weekly'}: {sym}{p.value.toFixed(0)}
        </p>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LayerDepletionAnalyzer() {
  const navigate   = useNavigate()
  const { fmt, currency } = useCurrency()
  const sym = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currency ?? 'USD', currencyDisplay: 'narrowSymbol',
      }).formatToParts(1).find(p => p.type === 'currency')?.value ?? currency ?? '$'
    } catch { return '$' }
  }, [currency])
  const batchData  = useLayerData()
  const [selIdx,   setSelIdx]   = useState(0)

  // Market inputs
  const [eggPrice,      setEggPrice]      = useState(4.00)   // per tray of 30
  const [feedCostPerKg, setFeedCostPerKg] = useState(0.42)
  const [spentHenPrice, setSpentHenPrice] = useState(2.50)   // per bird
  const [horizonWeeks,  setHorizonWeeks]  = useState(24)

  const batch = batchData?.[selIdx]

  const eggPricePerUnit = eggPrice / 30

  // Derived from batch or user overrides
  const [overrideFeed, setOverrideFeed] = useState<number | null>(null)
  const feedPerDay = overrideFeed ?? batch?.avgFeedKgPerDay ?? (LOHMANN_FEED_KG_PER_BIRD_DAY * (batch?.enterprise.currentStockCount ?? 1000))
  const birds = batch?.enterprise.currentStockCount ?? 0
  const ageWeeks = batch?.ageWeeks ?? 40

  const points = useMemo(() => {
    if (!birds) return []
    return calcWeeklyProjection({
      birds, currentAgeWeeks: ageWeeks, currentProdPct: batch?.prodPct ?? 0,
      dailyFeedKg: feedPerDay, feedCostPerKg, eggPricePerUnit,
      spentHenPricePerBird: spentHenPrice, horizonWeeks,
    })
  }, [birds, ageWeeks, batch?.prodPct, feedPerDay, feedCostPerKg, eggPricePerUnit, spentHenPrice, horizonWeeks])

  const optimalWeek = useMemo(
    () => findOptimalDepletionWeek(points, spentHenPrice, birds),
    [points, spentHenPrice, birds],
  )

  const breakEvenWeek = useMemo(() => {
    const first = points.find(p => p.marginalProfit < 0)
    return first?.week ?? null
  }, [points])

  const optimalAgeWeeks = ageWeeks + optimalWeek

  if (batchData === undefined) return <div className="flex h-dvh items-center justify-center text-gray-400 text-sm">Loading…</div>
  if (batchData !== undefined && batchData.length === 0) {
    return (
      <div className="min-h-dvh bg-gray-50">
        <PageHeader onBack={() => navigate(-1)} title="Layer Depletion" />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-4xl mb-3">🥚</p>
          <p className="text-gray-500 text-sm">No active layer flocks found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader onBack={() => navigate(-1)} title="When to Deplete?" />

      <div className="px-4 py-4 space-y-4">
        {/* Batch selector */}
        {batchData && batchData.length > 1 && (
          <div className="card p-3">
            <select value={selIdx} onChange={e => { setSelIdx(+e.target.value); setOverrideFeed(null) }} className="input text-sm">
              {batchData.map((d, i) => (
                <option key={d.enterprise.id} value={i}>{d.enterprise.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Batch summary */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Flock Info</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Age',       value: `${ageWeeks} wks` },
              { label: 'Birds',     value: birds.toLocaleString() },
              { label: 'Prod.',     value: `${batch?.prodPct ?? '—'}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-sm font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prices & Costs</p>
          <InputRow label="Egg price (per tray/30)" value={eggPrice}      onChange={setEggPrice}      step={0.10} suffix={`${sym}/tray`} />
          <InputRow label="Feed cost per kg"         value={feedCostPerKg} onChange={setFeedCostPerKg} step={0.01} suffix={`${sym}/kg`} />
          <InputRow label="Spent hen price / bird"   value={spentHenPrice} onChange={setSpentHenPrice} step={0.10} suffix={`${sym}/bird`} />
          <InputRow label="Daily feed consumed"      value={feedPerDay}    onChange={setOverrideFeed}  step={0.5}  suffix="kg/d" />
          <InputRow label="Forecast horizon (weeks)" value={horizonWeeks}  onChange={v => setHorizonWeeks(Math.round(v))} step={4} suffix="wks" />
        </div>

        {/* Recommendation */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-800 font-bold text-base">
            {optimalWeek > 0
              ? `Consider depleting in ${optimalWeek} weeks (age ${optimalAgeWeeks} wks)`
              : 'Optimal to deplete now'
            }
          </p>
          {breakEvenWeek && (
            <p className="text-amber-600 text-sm mt-1">
              Weekly margin turns negative at week {breakEvenWeek} (age {ageWeeks + breakEvenWeek} wks)
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Based on Lohmann Brown standard curve + current feed/egg prices
          </p>
        </div>

        {/* Chart */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Marginal & Cumulative Profit</p>
          <p className="text-xs text-gray-400 mb-3">Bars = weekly margin · Line = cumulative</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={points} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                interval={Math.floor(horizonWeeks / 8)} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                tickFormatter={v => `${sym}${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip sym={sym} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
              {optimalWeek > 0 && (
                <ReferenceLine
                  x={`W${optimalWeek}`}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{ value: 'Optimal', position: 'top', fontSize: 9, fill: '#f59e0b' }}
                />
              )}
              <Bar dataKey="marginalProfit" name="Weekly" radius={[2, 2, 0, 0]}>
                {points.map(p => (
                  <Cell key={p.week} fill={p.marginalProfit >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="cumulative" name="cumulative"
                stroke="#3b82f6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function PageHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
      <div className="flex items-center gap-3 py-3">
        <button onClick={onBack} className="touch-target -ml-2">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
    </div>
  )
}
