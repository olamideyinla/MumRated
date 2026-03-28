import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend,
} from 'recharts'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import { BROILER_BENCHMARKS, LAYER_BENCHMARKS, ross308StandardFCR } from '../../core/constants/breed-standards'
import type { EnterpriseInstance } from '../../shared/types'

// ── Metric calculation ────────────────────────────────────────────────────────

interface BroilerMetrics { fcr: number; mortalityPct: number; adgG: number; epef: number; name: string }
interface LayerMetrics   { peakPct: number; fcr: number; mortalityPct: number; hdpPct: number; name: string }
type Metrics = BroilerMetrics | LayerMetrics

async function calcBroilerMetrics(ent: EnterpriseInstance): Promise<BroilerMetrics | null> {
  const records = await db.broilerDailyRecords
    .where('enterpriseInstanceId').equals(ent.id).toArray()
  if (!records.length) return null

  const totalFeed   = records.reduce((s, r) => s + r.feedConsumedKg, 0)
  const totalDeaths = records.reduce((s, r) => s + r.mortalityCount, 0)
  const ageDays     = records.length
  const birdsStart  = ent.initialStockCount
  const birdsEnd    = ent.currentStockCount
  const livabilityPct = (birdsEnd / birdsStart) * 100
  const mortalityPct  = 100 - livabilityPct

  // Get final weight from last weight sample
  const withWeight = records.filter(r => r.bodyWeightSampleAvg && r.bodyWeightSampleAvg > 0)
  const finalWeightKg = withWeight.length ? withWeight[withWeight.length - 1].bodyWeightSampleAvg! : 2.0
  const initialWeightKg = 0.042
  const adgG = ageDays > 0 ? ((finalWeightKg - initialWeightKg) / ageDays) * 1000 : 0

  const liveWeightGained = (finalWeightKg - initialWeightKg) * birdsEnd
  const fcr = liveWeightGained > 0 ? totalFeed / liveWeightGained : 2.0
  const epef = fcr > 0 ? (livabilityPct * finalWeightKg * 100) / (ageDays * fcr) : 0

  return { fcr: +fcr.toFixed(2), mortalityPct: +mortalityPct.toFixed(1), adgG: +adgG.toFixed(1), epef: +epef.toFixed(0), name: ent.name }
}

async function calcLayerMetrics(ent: EnterpriseInstance): Promise<LayerMetrics | null> {
  const records = await db.layerDailyRecords
    .where('enterpriseInstanceId').equals(ent.id).toArray()
  if (!records.length) return null

  const totalFeed  = records.reduce((s, r) => s + r.feedConsumedKg, 0)
  const totalEggs  = records.reduce((s, r) => s + r.totalEggs, 0)
  const totalDeaths = records.reduce((s, r) => s + r.mortalityCount, 0)
  const days = records.length

  const avgBirds = ent.initialStockCount - totalDeaths / 2
  const hdpPct   = avgBirds > 0 ? (totalEggs / days / avgBirds) * 100 : 0
  const peakPct  = Math.max(...records.map(r => (r.totalEggs / ent.currentStockCount) * 100))
  const mortalityPct = (totalDeaths / ent.initialStockCount) * 100
  const fcr = totalEggs > 0 ? (totalFeed * 1000) / totalEggs : 3.0  // grams feed per egg

  return {
    peakPct: +peakPct.toFixed(1), fcr: +fcr.toFixed(2), mortalityPct: +mortalityPct.toFixed(1),
    hdpPct: +hdpPct.toFixed(1), name: ent.name,
  }
}

// ── Score normalization (0-100, higher = better) ──────────────────────────────

function scoreBroiler(m: BroilerMetrics, ref: typeof BROILER_BENCHMARKS.breed_standard): Record<string, number> {
  // For FCR: lower is better → invert
  const fcrScore       = Math.max(0, Math.min(100, 100 - (m.fcr - ref.fcr) * 100))
  const mortScore      = Math.max(0, Math.min(100, 100 - (m.mortalityPct - ref.mortalityPct) * 5))
  const adgScore       = Math.max(0, Math.min(100, (m.adgG / ref.adgG) * 100))
  const epefScore      = Math.max(0, Math.min(100, (m.epef / ref.epef) * 100))
  return { FCR: +fcrScore.toFixed(0), Mortality: +mortScore.toFixed(0), ADG: +adgScore.toFixed(0), EPEF: +epefScore.toFixed(0) }
}

function scoreLayer(m: LayerMetrics, ref: typeof LAYER_BENCHMARKS.breed_standard): Record<string, number> {
  const peakScore  = Math.max(0, Math.min(100, (m.peakPct / ref.peakPct) * 100))
  const fcrScore   = Math.max(0, Math.min(100, 100 - (m.fcr - ref.fcr) * 20))
  const mortScore  = Math.max(0, Math.min(100, 100 - (m.mortalityPct - ref.mortalityPct) * 5))
  const hdpScore   = Math.max(0, Math.min(100, (m.hdpPct / ref.hdpPct) * 100))
  return { 'Peak Prod.': +peakScore.toFixed(0), FCR: +fcrScore.toFixed(0), Mortality: +mortScore.toFixed(0), HDP: +hdpScore.toFixed(0) }
}

// ── Insight text ──────────────────────────────────────────────────────────────

function generateInsights(metrics: Metrics, isBroiler: boolean, benchmark: string): string[] {
  const insights: string[] = []
  if (isBroiler) {
    const m = metrics as BroilerMetrics
    const ref = benchmark === 'breed' ? BROILER_BENCHMARKS.breed_standard : BROILER_BENCHMARKS.good
    const fcrDiff = m.fcr - ref.fcr
    if (Math.abs(fcrDiff) > 0.05) {
      insights.push(`FCR of ${m.fcr} is ${fcrDiff > 0 ? 'higher' : 'lower'} than ${benchmark === 'breed' ? 'breed standard' : 'benchmark'} (${ref.fcr}). ${fcrDiff > 0 ? 'Check feed quality and feed wastage.' : 'Excellent feed conversion!'}`)
    }
    const mortDiff = m.mortalityPct - ref.mortalityPct
    if (mortDiff > 1) {
      insights.push(`Mortality of ${m.mortalityPct}% is ${mortDiff.toFixed(1)}% above target. Review biosecurity and early disease detection.`)
    }
  } else {
    const m = metrics as LayerMetrics
    const ref = benchmark === 'breed' ? LAYER_BENCHMARKS.breed_standard : LAYER_BENCHMARKS.good
    const hdpDiff = m.hdpPct - ref.hdpPct
    if (Math.abs(hdpDiff) > 2) {
      insights.push(`HDP of ${m.hdpPct}% is ${hdpDiff > 0 ? 'above' : 'below'} target (${ref.hdpPct}%). ${hdpDiff < 0 ? 'Check lighting, nutrition, and flock health.' : 'Outstanding production!'}`)
    }
  }
  if (!insights.length) insights.push('Performance is within expected range. Keep up the good work!')
  return insights
}

// ── Page ──────────────────────────────────────────────────────────────────────

type BenchmarkType = 'breed' | 'good' | 'average'

export default function BenchmarkTool() {
  const navigate = useNavigate()
  const appUser  = useAuthStore(s => s.appUser)
  const [selectedId, setSelectedId] = useState<string>('')
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkType>('breed')

  const enterprises = useLiveQuery(async () => {
    if (!appUser) return []
    const locs   = await db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray()
    const infras = await db.infrastructures.where('farmLocationId').anyOf(locs.map(l => l.id)).toArray()
    const infraIds = infras.map(i => i.id)
    if (!infraIds.length) return []
    return db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => (e.enterpriseType === 'broilers' || e.enterpriseType === 'layers') && e.status !== 'planned')
      .toArray()
  }, [appUser?.organizationId])

  const selectedEnt = enterprises?.find(e => e.id === selectedId) ?? enterprises?.[0]

  const metrics = useLiveQuery(async () => {
    if (!selectedEnt) return null
    if (selectedEnt.enterpriseType === 'broilers') return calcBroilerMetrics(selectedEnt)
    if (selectedEnt.enterpriseType === 'layers')   return calcLayerMetrics(selectedEnt)
    return null
  }, [selectedEnt?.id])

  const isBroiler = selectedEnt?.enterpriseType === 'broilers'

  const radarData = useMemo(() => {
    if (!metrics) return []
    const refMap = {
      breed: isBroiler ? BROILER_BENCHMARKS.breed_standard : LAYER_BENCHMARKS.breed_standard,
      good:  isBroiler ? BROILER_BENCHMARKS.good           : LAYER_BENCHMARKS.good,
      average: isBroiler ? BROILER_BENCHMARKS.average      : LAYER_BENCHMARKS.average,
    }
    const ref = refMap[benchmarkType]
    const currentScores  = isBroiler ? scoreBroiler(metrics as BroilerMetrics, ref as typeof BROILER_BENCHMARKS.breed_standard)
                                     : scoreLayer(metrics as LayerMetrics,   ref as typeof LAYER_BENCHMARKS.breed_standard)
    const refScores      = Object.fromEntries(Object.keys(currentScores).map(k => [k, 80]))

    return Object.keys(currentScores).map(metric => ({
      metric,
      current:   currentScores[metric],
      benchmark: refScores[metric],
    }))
  }, [metrics, benchmarkType, isBroiler])

  const insights = useMemo(() => {
    if (!metrics || !selectedEnt) return []
    return generateInsights(metrics, isBroiler, benchmarkType)
  }, [metrics, selectedEnt, isBroiler, benchmarkType])

  if (!enterprises) return <div className="flex h-dvh items-center justify-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Compare Performance</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {enterprises.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500 text-sm">No broiler or layer batches found to benchmark.</p>
          </div>
        ) : (
          <>
            {/* Enterprise selector */}
            <div className="card p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Select batch</label>
                <select
                  value={selectedId || selectedEnt?.id || ''}
                  onChange={e => setSelectedId(e.target.value)}
                  className="input text-sm"
                >
                  {enterprises.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.status})</option>
                  ))}
                </select>
              </div>

              {/* Benchmark selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Compare against</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  {([['breed', 'Breed Std'], ['good', 'Good Farm'], ['average', 'Average']] as [BenchmarkType, string][]).map(([v, lbl]) => (
                    <button key={v} onClick={() => setBenchmarkType(v)}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors
                        ${benchmarkType === v ? 'bg-primary-600 text-white' : 'text-gray-500 bg-white'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics summary */}
            {metrics && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Calculated Metrics</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(metrics)
                    .filter(([k]) => k !== 'name')
                    .map(([key, val]) => (
                      <div key={key} className="bg-gray-50 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-gray-400">{key}</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">{typeof val === 'number' ? val.toFixed(2) : val}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Radar chart */}
            {radarData.length > 0 && (
              <div className="card p-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Performance Radar</p>
                <p className="text-xs text-gray-400 mb-2">0 = worst · 100 = best · green = your batch</p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#9ca3af' }} />
                    <Radar name="Your batch" dataKey="current"   stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.25} />
                    <Radar name="Benchmark"  dataKey="benchmark" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.10} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <div className="card p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Insights</p>
                {insights.map((insight, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-primary-500 shrink-0 mt-0.5">💡</span>
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
