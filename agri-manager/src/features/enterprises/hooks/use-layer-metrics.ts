import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import { henDayProductionPct, layerCumulativeMortalityPct } from '../../../core/services/kpi-calculator'
import type { LayerDailyRecord } from '../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LayerMetrics {
  dayOfCycle: number
  currentHdpPct: number
  hdpTrend7d: number | null       // % point change vs 7 days ago
  cumulativeMortPct: number
  totalFeedKg: number
  totalEggs: number
  // Chart data
  weeklyProduction: Array<{ week: number; hdp: number }>    // for ProductionCurveChart
  weeklyMortality: Array<{ date: string; value: number }>   // for TrendLineChart (weekly mort count)
  dailyFeed: Array<{ date: string; value: number }>
  // Raw records
  records: LayerDailyRecord[]
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLayerMetrics(
  enterpriseId: string | undefined,
  startDate: string | undefined,
  currentStockCount: number,
  initialStockCount: number,
): LayerMetrics | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId || !startDate) return undefined

    const records = await db.layerDailyRecords
      .where('enterpriseInstanceId')
      .equals(enterpriseId)
      .sortBy('date') as LayerDailyRecord[]

    if (records.length === 0) {
      return {
        dayOfCycle: daysSince(startDate),
        currentHdpPct: 0, hdpTrend7d: null,
        cumulativeMortPct: 0, totalFeedKg: 0, totalEggs: 0,
        weeklyProduction: [], weeklyMortality: [], dailyFeed: [],
        records: [],
      }
    }

    const today = new Date().toISOString().split('T')[0]
    const dayOfCycle = daysSince(startDate)

    // Current HDP from latest record
    const latest = records[records.length - 1]
    const currentHdpPct = henDayProductionPct(latest.totalEggs, currentStockCount || initialStockCount)

    // 7-day trend
    const sevenDaysAgo = dateOffset(today, -7)
    const weekAgoRecord = records.find(r => r.date <= sevenDaysAgo)
    const hdpTrend7d = weekAgoRecord
      ? Math.round((currentHdpPct - henDayProductionPct(weekAgoRecord.totalEggs, currentStockCount || initialStockCount)) * 10) / 10
      : null

    const cumulativeMortPct = layerCumulativeMortalityPct(records, initialStockCount)
    const totalFeedKg = records.reduce((s, r) => s + r.feedConsumedKg, 0)
    const totalEggs   = records.reduce((s, r) => s + r.totalEggs, 0)

    // Weekly production data for curve chart
    const weeklyMap = new Map<number, { eggs: number; count: number }>()
    for (const r of records) {
      const week = weekOfAge(startDate, r.date)
      const existing = weeklyMap.get(week) ?? { eggs: 0, count: 0 }
      weeklyMap.set(week, { eggs: existing.eggs + r.totalEggs, count: existing.count + 1 })
    }
    const weeklyProduction: { week: number; hdp: number }[] = []
    const stock = currentStockCount || initialStockCount || 1
    weeklyMap.forEach((v, week) => {
      const avgDailyEggs = v.eggs / v.count
      weeklyProduction.push({ week, hdp: Math.round(henDayProductionPct(avgDailyEggs, stock) * 10) / 10 })
    })
    weeklyProduction.sort((a, b) => a.week - b.week)

    // Weekly mortality (last 8 weeks worth of records)
    const last56 = records.slice(-56)
    const weeklyMortMap = new Map<string, number>()
    for (const r of last56) {
      const wk = isoWeekLabel(r.date)
      weeklyMortMap.set(wk, (weeklyMortMap.get(wk) ?? 0) + r.mortalityCount)
    }
    const weeklyMortality = Array.from(weeklyMortMap.entries())
      .map(([date, value]) => ({ date, value }))
      .slice(-8)

    // Daily feed (last 30 records)
    const dailyFeed = records.slice(-30).map(r => ({ date: r.date.slice(5), value: r.feedConsumedKg }))

    return {
      dayOfCycle, currentHdpPct, hdpTrend7d, cumulativeMortPct,
      totalFeedKg: Math.round(totalFeedKg * 10) / 10,
      totalEggs,
      weeklyProduction, weeklyMortality, dailyFeed,
      records,
    }
  }, [enterpriseId, startDate, currentStockCount, initialStockCount])
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function dateOffset(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function weekOfAge(startDate: string, recordDate: string): number {
  const days = Math.floor((new Date(recordDate).getTime() - new Date(startDate).getTime()) / 86_400_000)
  return Math.floor(days / 7) + 1
}

function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const dayOfWeek = d.getDay() || 7
  d.setDate(d.getDate() - dayOfWeek + 1) // Monday
  return d.toISOString().split('T')[0]
}
