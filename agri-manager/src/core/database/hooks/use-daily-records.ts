import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'
import type {
  EnterpriseType,
  LayerDailyRecord, BroilerDailyRecord, CattleDailyRecord,
  FishDailyRecord, CropActivityRecord,
  PigDailyRecord, RabbitDailyRecord, CustomAnimalDailyRecord,
} from '../../../shared/types'

export type AnyDailyRecord =
  | LayerDailyRecord
  | BroilerDailyRecord
  | CattleDailyRecord
  | FishDailyRecord
  | CropActivityRecord
  | PigDailyRecord
  | RabbitDailyRecord
  | CustomAnimalDailyRecord

export interface DateRange { from: string; to: string }

export interface TodayEntryStatus {
  enterpriseId: string
  enterpriseName: string
  enterpriseType: EnterpriseType
  hasEntryToday: boolean
}

export interface WeeklySummary {
  weekStart: string
  weekEnd: string
  recordCount: number
  totalMortality?: number
  totalFeedKg?: number
  totalEggs?: number
  avgHdpPct?: number
  avgBodyWeightKg?: number
}

// ── useRecordsForEnterprise ───────────────────────────────────────────────────

/**
 * Live-updating records for an enterprise within an optional date range.
 * Returns the appropriate record type based on enterprise type.
 */
export function useRecordsForEnterprise(
  enterpriseId: string | undefined,
  dateRange?: DateRange,
): AnyDailyRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId) return []
    const enterprise = await db.enterpriseInstances.get(enterpriseId)
    if (!enterprise) return []

    const from = dateRange?.from ?? '0000-00-00'
    const to   = dateRange?.to   ?? '9999-99-99'

    const byCompound = (table: any) =>
      table
        .where('[enterpriseInstanceId+date]')
        .between([enterpriseId, from], [enterpriseId, to], true, true)
        .toArray()

    switch (enterprise.enterpriseType) {
      case 'layers':              return byCompound(db.layerDailyRecords)
      case 'broilers':            return byCompound(db.broilerDailyRecords)
      case 'cattle_dairy':
      case 'cattle_beef':         return byCompound(db.cattleDailyRecords)
      case 'fish':                return byCompound(db.fishDailyRecords)
      case 'pigs_breeding':
      case 'pigs_growfinish':     return byCompound(db.pigDailyRecords)
      case 'rabbit':              return byCompound(db.rabbitDailyRecords)
      case 'custom_animal':       return byCompound(db.customAnimalDailyRecords)
      case 'crop_annual':
      case 'crop_perennial': {
        const all = await db.cropActivityRecords
          .where('enterpriseInstanceId').equals(enterpriseId).toArray()
        return all.filter(r => r.date >= from && r.date <= to)
      }
      default: return []
    }
  }, [enterpriseId, dateRange?.from, dateRange?.to])
}

// ── useLatestRecord ───────────────────────────────────────────────────────────

/** The most recent record for an enterprise, regardless of type */
export function useLatestRecord(
  enterpriseId: string | undefined,
): AnyDailyRecord | undefined | null {
  return useLiveQuery(async () => {
    if (!enterpriseId) return null
    const enterprise = await db.enterpriseInstances.get(enterpriseId)
    if (!enterprise) return null

    const getLatest = async (table: any): Promise<AnyDailyRecord | null> => {
      const records = await table
        .where('enterpriseInstanceId').equals(enterpriseId)
        .reverse()
        .sortBy('date')
      return (records as AnyDailyRecord[])[0] ?? null
    }

    switch (enterprise.enterpriseType) {
      case 'layers':          return getLatest(db.layerDailyRecords)
      case 'broilers':        return getLatest(db.broilerDailyRecords)
      case 'cattle_dairy':
      case 'cattle_beef':     return getLatest(db.cattleDailyRecords)
      case 'fish':            return getLatest(db.fishDailyRecords)
      case 'pigs_breeding':
      case 'pigs_growfinish': return getLatest(db.pigDailyRecords)
      case 'rabbit':          return getLatest(db.rabbitDailyRecords)
      case 'custom_animal':   return getLatest(db.customAnimalDailyRecords)
      case 'crop_annual':
      case 'crop_perennial':  return getLatest(db.cropActivityRecords)
      default:                return null
    }
  }, [enterpriseId])
}

// ── useTodayEntryStatus ───────────────────────────────────────────────────────

/** Which active enterprises have or haven't had an entry recorded today */
export function useTodayEntryStatus(): TodayEntryStatus[] | undefined {
  const userId = useAuthStore(s => s.userId)
  return useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []

    const today = new Date().toISOString().split('T')[0]
    const locations = await db.farmLocations
      .where('organizationId').equals(user.organizationId).toArray()
    const locationIds = new Set(locations.map(l => l.id))
    const infras = await db.infrastructures.toArray()
    const orgInfraIds = infras.filter(i => locationIds.has(i.farmLocationId)).map(i => i.id)
    const enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(orgInfraIds)
      .filter(e => e.status === 'active')
      .toArray()

    const results: TodayEntryStatus[] = []

    for (const ent of enterprises) {
      let hasEntryToday = false

      const checkCompound = async (table: any) =>
        await table.where('[enterpriseInstanceId+date]').equals([ent.id, today]).count() > 0

      switch (ent.enterpriseType) {
        case 'layers':          hasEntryToday = await checkCompound(db.layerDailyRecords); break
        case 'broilers':        hasEntryToday = await checkCompound(db.broilerDailyRecords); break
        case 'cattle_dairy':
        case 'cattle_beef':     hasEntryToday = await checkCompound(db.cattleDailyRecords); break
        case 'fish':            hasEntryToday = await checkCompound(db.fishDailyRecords); break
        case 'pigs_breeding':
        case 'pigs_growfinish': hasEntryToday = await checkCompound(db.pigDailyRecords); break
        case 'rabbit':          hasEntryToday = await checkCompound(db.rabbitDailyRecords); break
        case 'custom_animal':   hasEntryToday = await checkCompound(db.customAnimalDailyRecords); break
        case 'crop_annual':
        case 'crop_perennial':
          hasEntryToday = await db.cropActivityRecords
            .where('enterpriseInstanceId').equals(ent.id)
            .filter(r => r.date === today).count() > 0
          break
      }

      results.push({
        enterpriseId: ent.id,
        enterpriseName: ent.name,
        enterpriseType: ent.enterpriseType,
        hasEntryToday,
      })
    }

    return results
  }, [userId])
}

// ── useWeeklySummary ──────────────────────────────────────────────────────────

/** Returns ISO week date range (Monday–Sunday) for a given ISO week number and year */
function isoWeekRange(year: number, weekNumber: number): [string, string] {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const weekStart = new Date(jan4)
  weekStart.setDate(jan4.getDate() - (day - 1) + (weekNumber - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  return [
    weekStart.toISOString().split('T')[0],
    weekEnd.toISOString().split('T')[0],
  ]
}

/**
 * Aggregated weekly summary for an enterprise.
 * weekNumber is the ISO week of the year (1–53); year defaults to current year.
 */
export function useWeeklySummary(
  enterpriseId: string | undefined,
  weekNumber: number,
  year?: number,
): WeeklySummary | undefined | null {
  const y = year ?? new Date().getFullYear()

  return useLiveQuery(async () => {
    if (!enterpriseId) return null
    const enterprise = await db.enterpriseInstances.get(enterpriseId)
    if (!enterprise) return null

    const [from, to] = isoWeekRange(y, weekNumber)

    let recordCount = 0
    let totalMortality: number | undefined
    let totalFeedKg: number | undefined
    let totalEggs: number | undefined
    let avgBodyWeightKg: number | undefined
    let avgHdpPct: number | undefined

    const rangeOf = (table: any) =>
      table
        .where('[enterpriseInstanceId+date]')
        .between([enterpriseId, from], [enterpriseId, to], true, true)
        .toArray()

    switch (enterprise.enterpriseType) {
      case 'layers': {
        const records = await rangeOf(db.layerDailyRecords) as LayerDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalEggs = records.reduce((s, r) => s + r.totalEggs, 0)
          totalMortality = records.reduce((s, r) => s + r.mortalityCount, 0)
          totalFeedKg = records.reduce((s, r) => s + r.feedConsumedKg, 0)
          const stock = enterprise.currentStockCount || 1
          avgHdpPct = Math.round((totalEggs / (recordCount * stock)) * 1000) / 10
        }
        break
      }
      case 'broilers': {
        const records = await rangeOf(db.broilerDailyRecords) as BroilerDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalMortality = records.reduce((s, r) => s + r.mortalityCount, 0)
          totalFeedKg = records.reduce((s, r) => s + r.feedConsumedKg, 0)
          const ws = records.filter(r => r.bodyWeightSampleAvg != null)
          if (ws.length > 0)
            avgBodyWeightKg = ws.reduce((s, r) => s + (r.bodyWeightSampleAvg ?? 0), 0) / ws.length
        }
        break
      }
      case 'cattle_dairy':
      case 'cattle_beef': {
        const records = await rangeOf(db.cattleDailyRecords) as CattleDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalMortality = records.reduce((s, r) => s + (r.deaths ?? 0), 0)
          totalFeedKg = records.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
        }
        break
      }
      case 'fish': {
        const records = await rangeOf(db.fishDailyRecords) as FishDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalMortality = records.reduce((s, r) => s + (r.estimatedMortality ?? 0), 0)
          totalFeedKg = records.reduce((s, r) => s + r.feedGivenKg, 0)
        }
        break
      }
      case 'pigs_breeding':
      case 'pigs_growfinish': {
        const records = await rangeOf(db.pigDailyRecords) as PigDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalMortality = records.reduce((s, r) => s + r.mortalityCount, 0)
          totalFeedKg = records.reduce((s, r) => s + r.feedConsumedKg, 0)
          const ws = records.filter(r => r.avgBodyWeightSampleKg != null)
          if (ws.length > 0)
            avgBodyWeightKg = ws.reduce((s, r) => s + (r.avgBodyWeightSampleKg ?? 0), 0) / ws.length
        }
        break
      }
      case 'rabbit': {
        const records = await rangeOf(db.rabbitDailyRecords) as RabbitDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalMortality = records.reduce((s, r) => s + r.mortalityCount, 0)
          totalFeedKg = records.reduce((s, r) => s + r.feedConsumedKg, 0)
          const ws = records.filter(r => r.avgBodyWeightSampleKg != null)
          if (ws.length > 0)
            avgBodyWeightKg = ws.reduce((s, r) => s + (r.avgBodyWeightSampleKg ?? 0), 0) / ws.length
        }
        break
      }
      case 'custom_animal': {
        const records = await rangeOf(db.customAnimalDailyRecords) as CustomAnimalDailyRecord[]
        recordCount = records.length
        if (recordCount > 0) {
          totalMortality = records.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
          totalFeedKg = records.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
        }
        break
      }
      case 'crop_annual':
      case 'crop_perennial': {
        const all = await db.cropActivityRecords
          .where('enterpriseInstanceId').equals(enterpriseId).toArray()
        const records = all.filter(r => r.date >= from && r.date <= to)
        recordCount = records.length
        break
      }
    }

    return { weekStart: from, weekEnd: to, recordCount, totalMortality, totalFeedKg, totalEggs, avgHdpPct, avgBodyWeightKg }
  }, [enterpriseId, weekNumber, y])
}
