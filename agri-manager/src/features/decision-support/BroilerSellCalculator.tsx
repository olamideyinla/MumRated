import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { useAuthStore } from '../../stores/auth-store'
import { useCurrency } from '../../shared/hooks/useCurrency'
import { db } from '../../core/database/db'
import type { EnterpriseInstance, BroilerDailyRecord } from '../../shared/types'

// ── Data loading ──────────────────────────────────────────────────────────────

function useBroilerData() {
  const appUser = useAuthStore(s => s.appUser)

  return useLiveQuery(async () => {
    if (!appUser) return null
    const locs = await db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray()
    const infras = await db.infrastructures.where('farmLocationId').anyOf(locs.map(l => l.id)).toArray()
    const infraIds = infras.map(i => i.id)
    if (!infraIds.length) return null

    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => e.enterpriseType === 'broilers' && e.status === 'active')
      .toArray()

    const withRecords = await Promise.all(enterprises.map(async ent => {
      const records = await db.broilerDailyRecords
        .where('enterpriseInstanceId').equals(ent.id)
        .reverse().sortBy('date')
      return { enterprise: ent, records: records.slice(0, 14) }
    }))

    return withRecords.filter(d => d.records.length > 0)
  }, [appUser?.organizationId])
}

// ── Calculation ───────────────────────────────────────────────────────────────

function deriveDefaults(records: BroilerDailyRecord[], enterprise: EnterpriseInstance) {
  const last14 = records.slice(0, 14)

  // Daily weight gain from last two weight samples
  const withWeight = last14.filter(r => r.bodyWeightSampleAvg != null && r.bodyWeightSampleAvg! > 0)
  let dailyGainKg = 0.06 // Ross 308 default ~60g/day
  if (withWeight.length >= 2) {
    const newest = withWeight[0]
    const older  = withWeight[withWeight.length - 1]
    const days   = (new Date(newest.date).getTime() - new Date(older.date).getTime()) / 86400000
    if (days > 0 && newest.bodyWeightSampleAvg! > older.bodyWeightSampleAvg!) {
      dailyGainKg = (newest.bodyWeightSampleAvg! - older.bodyWeightSampleAvg!) / days
    }
  }

  // Current weight
  const currentWeightKg = withWeight[0]?.bodyWeightSampleAvg ?? 1.8

  // Average daily feed (last 7)
  const avgDailyFeedKg = last14.slice(0, 7).reduce((s, r) => s + r.feedConsumedKg, 0) / Math.min(7, last14.length)

  // Daily mortality rate
  const totalDays  = last14.length
  const totalDeaths = last14.reduce((s, r) => s + r.mortalityCount, 0)
  const dailyMortalityRate = totalDays > 0 ? totalDeaths / enterprise.currentStockCount / totalDays : 0.001

  return {
    currentWeightKg: +currentWeightKg.toFixed(3),
    dailyGainKg:     +dailyGainKg.toFixed(3),
    avgDailyFeedKg:  +avgDailyFeedKg.toFixed(2),
    dailyMortalityRate,
    birds: enterprise.currentStockCount,
  }
}

function calcScenarios(params: {
  birds: number
  currentWeightKg: number
  dailyGainKg: number
  avgDailyFeedKg: number
  dailyMortalityRate: number
  feedCostPerKg: number
  pricePerKg: number
  targetWeightKg: number
}) {
  const {
    birds, currentWeightKg, dailyGainKg, avgDailyFeedKg,
    dailyMortalityRate, feedCostPerKg, pricePerKg, targetWeightKg,
  } = params

  const daysToTarget = dailyGainKg > 0
    ? Math.max(0, (targetWeightKg - currentWeightKg) / dailyGainKg)
    : 0
  const daysInt = Math.ceil(daysToTarget)

  const mortalityWaiting = Math.round(birds * dailyMortalityRate * daysInt)
  const birdsAtTarget    = birds - mortalityWaiting

  const revenueToday     = birds * currentWeightKg * pricePerKg
  const revenueAtTarget  = birdsAtTarget * targetWeightKg * pricePerKg
  const addFeedCost      = avgDailyFeedKg * feedCostPerKg * daysInt
  const netBenefitWait   = (revenueAtTarget - revenueToday) - addFeedCost

  return { daysInt, revenueToday, revenueAtTarget, addFeedCost, netBenefitWait, mortalityWaiting, birdsAtTarget }
}

// ── Chart data ────────────────────────────────────────────────────────────────


// ── Sub-components ────────────────────────────────────────────────────────────

function InputRow({ label, value, onChange, min = 0, step = 0.01, suffix = '' }: {
  label: string; value: number; onChange: (n: number) => void
  min?: number; step?: number; suffix?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {suffix && <span className="text-xs text-gray-400 w-8">{suffix}</span>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BroilerSellCalculator() {
  const navigate  = useNavigate()
  const batchData = useBroilerData()
  const { fmt: fmtUSD } = useCurrency()

  const [selectedIdx, setSelectedIdx] = useState(0)

  const batch = batchData?.[selectedIdx]
  const derived = useMemo(() => {
    if (!batch) return null
    return deriveDefaults(batch.records, batch.enterprise)
  }, [batch])

  // User-editable inputs
  const [pricePerKg,    setPricePerKg]    = useState(2.20)
  const [targetWeight,  setTargetWeight]  = useState(2.20)
  const [feedCostPerKg, setFeedCostPerKg] = useState(0.45)
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [dailyGain,     setDailyGain]     = useState<number | null>(null)
  const [dailyFeed,     setDailyFeed]     = useState<number | null>(null)

  const cw  = currentWeight ?? derived?.currentWeightKg ?? 1.8
  const dg  = dailyGain     ?? derived?.dailyGainKg     ?? 0.060
  const df  = dailyFeed     ?? derived?.avgDailyFeedKg  ?? 80
  const birds = derived?.birds ?? 0
  const dmr   = derived?.dailyMortalityRate ?? 0.001

  const calc = useMemo(() => calcScenarios({
    birds, currentWeightKg: cw, dailyGainKg: dg,
    avgDailyFeedKg: df, dailyMortalityRate: dmr,
    feedCostPerKg, pricePerKg, targetWeightKg: targetWeight,
  }), [birds, cw, dg, df, dmr, feedCostPerKg, pricePerKg, targetWeight])

  const chartData = [
    { name: 'Revenue',  today: Math.round(calc.revenueToday), waiting: Math.round(calc.revenueAtTarget) },
    { name: 'Add. Cost', today: 0,                            waiting: Math.round(calc.addFeedCost) },
    { name: 'Net Gain',  today: Math.round(calc.revenueToday), waiting: Math.round(calc.revenueAtTarget - calc.addFeedCost) },
  ]

  const waitIsBetter = calc.netBenefitWait > 0

  if (batchData === undefined) {
    return <div className="flex h-dvh items-center justify-center text-gray-400 text-sm">Loading…</div>
  }

  if (batchData !== undefined && batchData.length === 0) {
    return (
      <div className="min-h-dvh bg-gray-50">
        <Header onBack={() => navigate(-1)} title="Sell or Wait?" />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-4xl mb-3">🐔</p>
          <p className="text-gray-500 text-sm">No active broiler batches found.</p>
          <p className="text-gray-400 text-xs mt-1">Start a broiler enterprise to use this tool.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header onBack={() => navigate(-1)} title="Sell or Wait?" />

      <div className="px-4 py-4 space-y-4">
        {/* Batch selector */}
        {batchData && batchData.length > 1 && (
          <div className="card p-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Select batch</label>
            <select
              value={selectedIdx}
              onChange={e => { setSelectedIdx(+e.target.value); setCurrentWeight(null); setDailyGain(null); setDailyFeed(null) }}
              className="input text-sm"
            >
              {batchData.map((d, i) => (
                <option key={d.enterprise.id} value={i}>{d.enterprise.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pre-filled data */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Batch Data (auto-filled · editable)
          </p>
          <InputRow label="Birds alive"          value={birds}       onChange={() => {}} step={1} suffix="birds" />
          <InputRow label="Current avg weight"   value={cw}          onChange={v => setCurrentWeight(v)} step={0.01} suffix="kg" />
          <InputRow label="Daily weight gain"    value={dg}          onChange={v => setDailyGain(v)} step={0.001} suffix="kg/d" />
          <InputRow label="Daily feed consumed"  value={df}          onChange={v => setDailyFeed(v)} step={0.5} suffix="kg" />
        </div>

        {/* Market inputs */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Market Inputs</p>
          <InputRow label="Current market price" value={pricePerKg}    onChange={setPricePerKg}    step={0.01} suffix="$/kg" />
          <InputRow label="Feed cost per kg"     value={feedCostPerKg} onChange={setFeedCostPerKg} step={0.01} suffix="$/kg" />
          <InputRow label="Target sell weight"   value={targetWeight}  onChange={setTargetWeight}  step={0.05} suffix="kg" />
        </div>

        {/* Comparison cards */}
        <div className="grid grid-cols-2 gap-3">
          <ScenarioCard
            title="SELL TODAY"
            color="border-l-emerald-500"
            rows={[
              { label: 'Revenue',    value: fmtUSD(calc.revenueToday) },
              { label: 'Birds',      value: `${birds.toLocaleString()}` },
              { label: 'Weight',     value: `${cw.toFixed(2)} kg` },
            ]}
          />
          <ScenarioCard
            title={`WAIT ${calc.daysInt} DAYS`}
            color="border-l-blue-500"
            rows={[
              { label: 'Revenue',     value: fmtUSD(calc.revenueAtTarget) },
              { label: 'Add. cost',   value: fmtUSD(calc.addFeedCost), muted: true },
              { label: 'Net revenue', value: fmtUSD(calc.revenueAtTarget - calc.addFeedCost) },
              { label: 'Mortality',   value: `${calc.mortalityWaiting} birds`, muted: true },
            ]}
          />
        </div>

        {/* Bottom line */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${waitIsBetter ? 'bg-emerald-50 border border-emerald-200' : 'bg-orange-50 border border-orange-200'}`}>
          {waitIsBetter
            ? <TrendingUp className="w-7 h-7 text-emerald-600 shrink-0" />
            : <TrendingDown className="w-7 h-7 text-orange-600 shrink-0" />
          }
          <div>
            <p className={`font-bold text-base ${waitIsBetter ? 'text-emerald-800' : 'text-orange-800'}`}>
              {waitIsBetter
                ? `Waiting could earn you ${fmtUSD(calc.netBenefitWait)} more`
                : `Selling now is better by ${fmtUSD(-calc.netBenefitWait)}`
              }
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {waitIsBetter
                ? `${calc.daysInt} more days of feeding at ${fmtUSD(calc.addFeedCost)} total cost`
                : 'Current weight already optimal for this price'
              }
            </p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Revenue Comparison</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(v: number) => [fmtUSD(v)]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="today" name="Sell Today" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="waiting" name={`Wait ${calc.daysInt}d`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title: string }) {
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

function ScenarioCard({ title, color, rows }: {
  title: string
  color: string
  rows: { label: string; value: string; muted?: boolean }[]
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${color} p-3 shadow-sm`}>
      <p className="text-xs font-bold text-gray-500 tracking-wide mb-2">{title}</p>
      {rows.map(r => (
        <div key={r.label} className="flex flex-col mb-1.5 last:mb-0">
          <span className="text-[10px] text-gray-400">{r.label}</span>
          <span className={`text-sm font-bold leading-tight ${r.muted ? 'text-gray-400' : 'text-gray-900'}`}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
