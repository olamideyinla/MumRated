import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import type { FishDailyRecord } from '../../../shared/types'

export interface WaterQualityReading {
  waterTemp?: number
  waterPh?: number
  dissolvedOxygen?: number
  ammonia?: number
  date: string
}

export interface FishMetrics {
  daysSinceStocking: number
  survivalPct: number
  estimatedBiomassKg: number | null
  fcr: number
  latestWQ: WaterQualityReading | null
  feedHistory: Array<{ date: string; value: number }>
  mortalityHistory: Array<{ date: string; value: number }>
  records: FishDailyRecord[]
}

export function useFishMetrics(
  enterpriseId: string | undefined,
  startDate: string | undefined,
  currentStockCount: number,
  initialStockCount: number,
): FishMetrics | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId || !startDate) return undefined

    const records = await db.fishDailyRecords
      .where('enterpriseInstanceId')
      .equals(enterpriseId)
      .sortBy('date') as FishDailyRecord[]

    const daysSinceStocking = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000))
    const empty: FishMetrics = {
      daysSinceStocking, survivalPct: 100, estimatedBiomassKg: null,
      fcr: 0, latestWQ: null, feedHistory: [], mortalityHistory: [], records: [],
    }
    if (records.length === 0) return empty

    const totalFeed = records.reduce((s, r) => s + r.feedGivenKg, 0)
    const totalMort = records.reduce((s, r) => s + (r.estimatedMortality ?? 0), 0)
    const survivalPct = initialStockCount > 0
      ? Math.round((currentStockCount / initialStockCount) * 1000) / 10
      : 100

    // Estimated biomass = current stock × avg estimated weight
    // Without weight samples, estimate from growth using FCR and feed
    // Simplified: biomass = current stock × (totalFeed / currentStock * 0.25) as a proxy
    // We leave it null if no meaningful data
    const estimatedBiomassKg = currentStockCount > 0 && totalFeed > 0
      ? Math.round(totalFeed * 0.25 * 10) / 10
      : null

    const fcr = estimatedBiomassKg && estimatedBiomassKg > 0
      ? Math.round((totalFeed / estimatedBiomassKg) * 100) / 100
      : 0

    // Latest water quality reading
    const latestWithWQ = [...records].reverse().find(
      r => r.waterTemp != null || r.waterPh != null || r.dissolvedOxygen != null || r.ammonia != null
    )
    const latestWQ: WaterQualityReading | null = latestWithWQ
      ? {
          waterTemp: latestWithWQ.waterTemp,
          waterPh: latestWithWQ.waterPh,
          dissolvedOxygen: latestWithWQ.dissolvedOxygen,
          ammonia: latestWithWQ.ammonia,
          date: latestWithWQ.date,
        }
      : null

    const feedHistory = records.slice(-30).map(r => ({ date: r.date.slice(5), value: r.feedGivenKg }))
    const mortalityHistory = records.slice(-30).map(r => ({ date: r.date.slice(5), value: r.estimatedMortality ?? 0 }))

    return {
      daysSinceStocking, survivalPct, estimatedBiomassKg,
      fcr, latestWQ, feedHistory, mortalityHistory, records,
    }
  }, [enterpriseId, startDate, currentStockCount, initialStockCount])
}
