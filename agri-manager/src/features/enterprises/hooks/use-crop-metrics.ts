import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import type { CropActivityRecord } from '../../../shared/types'

export interface CropMetrics {
  daysSincePlanting: number
  latestGrowthStage: string | null
  totalHarvestKg: number
  totalLaborHours: number
  activityCounts: Partial<Record<string, number>>
  activities: CropActivityRecord[]   // all, newest first
  recentActivities: CropActivityRecord[]  // last 10
}

export function useCropMetrics(
  enterpriseId: string | undefined,
  startDate: string | undefined,
): CropMetrics | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId || !startDate) return undefined

    const records = await db.cropActivityRecords
      .where('enterpriseInstanceId')
      .equals(enterpriseId)
      .sortBy('date') as CropActivityRecord[]

    const daysSincePlanting = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000))

    const empty: CropMetrics = {
      daysSincePlanting, latestGrowthStage: null,
      totalHarvestKg: 0, totalLaborHours: 0,
      activityCounts: {}, activities: [], recentActivities: [],
    }
    if (records.length === 0) return empty

    const reversed = [...records].reverse()

    // Latest growth stage (from most recent record that has one)
    const latestWithStage = reversed.find(r => r.growthStage)
    const latestGrowthStage = latestWithStage?.growthStage ?? null

    const totalHarvestKg = records
      .filter(r => r.activityType === 'harvesting')
      .reduce((s, r) => s + (r.harvestQuantityKg ?? 0), 0)

    const totalLaborHours = records.reduce((s, r) => s + (r.laborHours ?? 0), 0)

    const activityCounts: Partial<Record<string, number>> = {}
    for (const r of records) {
      activityCounts[r.activityType] = (activityCounts[r.activityType] ?? 0) + 1
    }

    return {
      daysSincePlanting,
      latestGrowthStage,
      totalHarvestKg: Math.round(totalHarvestKg * 10) / 10,
      totalLaborHours: Math.round(totalLaborHours * 10) / 10,
      activityCounts,
      activities: reversed,
      recentActivities: reversed.slice(0, 10),
    }
  }, [enterpriseId, startDate])
}
