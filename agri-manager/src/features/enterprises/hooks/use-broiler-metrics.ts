import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import { broilerFcr, broilerSurvivalPct, ross308WeightForDay } from '../../../core/services/kpi-calculator'
import type { BroilerDailyRecord } from '../../../shared/types'

export interface BroilerMetrics {
  dayOfCycle: number
  mortalityPct: number
  survivalPct: number
  latestWeightKg: number | null
  fcr: number
  epef: number              // European Production Efficiency Factor
  totalFeedKg: number
  // Chart data
  growthData: Array<{ day: number; actualKg: number | null }>   // for GrowthCurveChart
  dailyMortality: Array<{ date: string; value: number }>
  // Raw records
  records: BroilerDailyRecord[]
}

export function useBroilerMetrics(
  enterpriseId: string | undefined,
  startDate: string | undefined,
  currentStockCount: number,
  initialStockCount: number,
): BroilerMetrics | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId || !startDate) return undefined

    const records = await db.broilerDailyRecords
      .where('enterpriseInstanceId')
      .equals(enterpriseId)
      .sortBy('date') as BroilerDailyRecord[]

    const dayOfCycle = daysSince(startDate)
    const empty: BroilerMetrics = {
      dayOfCycle, mortalityPct: 0, survivalPct: 100,
      latestWeightKg: null, fcr: 0, epef: 0, totalFeedKg: 0,
      growthData: [], dailyMortality: [], records: [],
    }
    if (records.length === 0) return empty

    const latestWithWeight = [...records].reverse().find(r => r.bodyWeightSampleAvg != null)
    const latestWeightKg = latestWithWeight?.bodyWeightSampleAvg ?? null

    const totalFeedKg = records.reduce((s, r) => s + r.feedConsumedKg, 0)
    const totalMort   = records.reduce((s, r) => s + r.mortalityCount, 0)
    const mortalityPct = Math.round((totalMort / (initialStockCount || 1)) * 1000) / 10
    const survivalPct  = broilerSurvivalPct(initialStockCount, currentStockCount)
    const fcr = latestWeightKg
      ? broilerFcr(records, currentStockCount, latestWeightKg)
      : 0

    // EPEF = (Survival% × Avg Weight × 100) / (FCR × Age)
    const epef = (fcr > 0 && dayOfCycle > 0 && latestWeightKg)
      ? Math.round((survivalPct * latestWeightKg * 100) / (fcr * dayOfCycle))
      : 0

    // Growth data for chart (records with weight samples)
    const growthData = records
      .filter(r => r.bodyWeightSampleAvg != null)
      .map(r => ({
        day: Math.floor((new Date(r.date).getTime() - new Date(startDate).getTime()) / 86_400_000),
        actualKg: r.bodyWeightSampleAvg ?? null,
      }))

    const dailyMortality = records.slice(-30).map(r => ({
      date: r.date.slice(5),
      value: r.mortalityCount,
    }))

    return {
      dayOfCycle, mortalityPct, survivalPct,
      latestWeightKg, fcr, epef,
      totalFeedKg: Math.round(totalFeedKg * 10) / 10,
      growthData, dailyMortality, records,
    }
  }, [enterpriseId, startDate, currentStockCount, initialStockCount])
}

function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000))
}

// Re-export for use in BroilerOverview without extra import
export { ross308WeightForDay }
