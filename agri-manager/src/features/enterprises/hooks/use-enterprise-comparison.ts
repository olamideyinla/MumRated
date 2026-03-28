import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/database/db'
import type { EnterpriseInstance, EnterpriseType } from '../../../shared/types'
import type { AnyDailyRecord } from '../../../core/database/hooks/use-daily-records'

export interface BatchOption {
  enterprise: EnterpriseInstance
  label: string
}

export interface ComparisonData {
  currentRecords: AnyDailyRecord[]
  comparedRecords: AnyDailyRecord[]
  comparedEnterprise: EnterpriseInstance | null
}

// ── Available batches of the same type ────────────────────────────────────────

export function useAvailableBatches(
  currentId: string | undefined,
  enterpriseType: EnterpriseType | undefined,
  infrastructureId: string | undefined,
): BatchOption[] | undefined {
  return useLiveQuery(async () => {
    if (!currentId || !enterpriseType || !infrastructureId) return []

    const all = await db.enterpriseInstances
      .where('infrastructureId')
      .equals(infrastructureId)
      .filter(e => e.enterpriseType === enterpriseType && e.id !== currentId)
      .sortBy('startDate') as EnterpriseInstance[]

    return all.reverse().map(e => ({
      enterprise: e,
      label: `${e.name} (${e.startDate})`,
    }))
  }, [currentId, enterpriseType, infrastructureId])
}

// ── Comparison data ───────────────────────────────────────────────────────────

export function useComparisonData(
  currentId: string | undefined,
  comparedId: string | undefined,
  enterpriseType: EnterpriseType | undefined,
): ComparisonData | undefined {
  return useLiveQuery(async () => {
    if (!currentId || !enterpriseType) return undefined

    const currentRecords = await loadRecords(currentId, enterpriseType)
    const comparedRecords = comparedId ? await loadRecords(comparedId, enterpriseType) : []
    const comparedEnterprise = comparedId ? await db.enterpriseInstances.get(comparedId) ?? null : null

    return { currentRecords, comparedRecords, comparedEnterprise }
  }, [currentId, comparedId, enterpriseType])
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function loadRecords(enterpriseId: string, type: EnterpriseType): Promise<AnyDailyRecord[]> {
  switch (type) {
    case 'layers':
      return db.layerDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'broilers':
      return db.broilerDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'cattle_dairy':
    case 'cattle_beef':
      return db.cattleDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'fish':
      return db.fishDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'pigs_breeding':
    case 'pigs_growfinish':
      return db.pigDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'rabbit':
      return db.rabbitDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'custom_animal':
      return db.customAnimalDailyRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    case 'crop_annual':
    case 'crop_perennial':
      return db.cropActivityRecords.where('enterpriseInstanceId').equals(enterpriseId).sortBy('date')
    default:
      return []
  }
}
