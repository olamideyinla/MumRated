import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import type { CattleDailyRecord } from '../../../shared/types'

export interface CattleMetrics {
  isDairy: boolean
  totalMilkToday: number
  totalMilkThisMonth: number
  avgMilkPerCow: number         // total today / herd count
  herdCount: number
  birthsThisMonth: number
  deathsThisMonth: number
  milkTrend30d: Array<{ date: string; value: number }>
  records: CattleDailyRecord[]
}

export function useCattleMetrics(
  enterpriseId: string | undefined,
  enterpriseType: string | undefined,
  currentStockCount: number,
): CattleMetrics | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId) return undefined

    const isDairy = enterpriseType === 'cattle_dairy'

    const records = await db.cattleDailyRecords
      .where('enterpriseInstanceId')
      .equals(enterpriseId)
      .sortBy('date') as CattleDailyRecord[]

    const empty: CattleMetrics = {
      isDairy, totalMilkToday: 0, totalMilkThisMonth: 0,
      avgMilkPerCow: 0, herdCount: currentStockCount,
      birthsThisMonth: 0, deathsThisMonth: 0,
      milkTrend30d: [], records: [],
    }
    if (records.length === 0) return empty

    const today = new Date().toISOString().split('T')[0]
    const thisMonth = today.slice(0, 7)

    const todayRecord = records.find(r => r.date === today)
    const totalMilkToday = todayRecord?.milkYieldLiters ?? 0

    const monthRecords = records.filter(r => r.date.startsWith(thisMonth))
    const totalMilkThisMonth = monthRecords.reduce((s, r) => s + (r.milkYieldLiters ?? 0), 0)
    const birthsThisMonth = monthRecords.reduce((s, r) => s + (r.births ?? 0), 0)
    const deathsThisMonth = monthRecords.reduce((s, r) => s + (r.deaths ?? 0), 0)

    const herdCount = currentStockCount
    const avgMilkPerCow = (herdCount > 0 && totalMilkToday > 0)
      ? Math.round((totalMilkToday / herdCount) * 10) / 10
      : 0

    const milkTrend30d = records
      .slice(-30)
      .filter(r => isDairy)
      .map(r => ({ date: r.date.slice(5), value: r.milkYieldLiters ?? 0 }))

    return {
      isDairy, totalMilkToday: Math.round(totalMilkToday * 10) / 10,
      totalMilkThisMonth: Math.round(totalMilkThisMonth * 10) / 10,
      avgMilkPerCow, herdCount, birthsThisMonth, deathsThisMonth,
      milkTrend30d, records,
    }
  }, [enterpriseId, enterpriseType, currentStockCount])
}
