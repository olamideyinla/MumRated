import type { BaseEntity } from './base'

export interface BaseDailyRecord extends BaseEntity {
  enterpriseInstanceId: string
  date: string  // YYYY-MM-DD
  recordedBy: string
  notes?: string
}

export interface LayerDailyRecord extends BaseDailyRecord {
  totalEggs: number
  brokenEggs?: number
  rejectEggs?: number
  mortalityCount: number
  mortalityCause?: string
  feedConsumedKg: number
  feedType?: string
  waterConsumedLiters?: number
  temperatureHigh?: number
  temperatureLow?: number
}

export interface BroilerDailyRecord extends BaseDailyRecord {
  mortalityCount: number
  mortalityCause?: string
  feedConsumedKg: number
  feedType?: string
  waterConsumedLiters?: number
  bodyWeightSampleAvg?: number
  bodyWeightSampleSize?: number
}

export interface CattleDailyRecord extends BaseDailyRecord {
  milkYieldLiters?: number
  milkingCount?: number
  feedConsumedKg?: number
  feedType?: string
  deaths?: number
  births?: number
  healthNotes?: string
}

export interface FishDailyRecord extends BaseDailyRecord {
  feedGivenKg: number
  feedType?: string
  estimatedMortality?: number
  waterTemp?: number
  waterPh?: number
  dissolvedOxygen?: number
  ammonia?: number
}

// ── Pig ───────────────────────────────────────────────────────────────────────

export interface PigDailyRecord extends BaseDailyRecord {
  mortalityCount: number
  mortalityCause?: string
  feedConsumedKg: number
  feedType?: string
  waterConsumedLiters?: number
  birthCount?: number            // Piglets farrowed
  weanCount?: number             // Piglets weaned
  avgBodyWeightSampleKg?: number
  bodyWeightSampleSize?: number
  healthNotes?: string
}

// ── Rabbit ────────────────────────────────────────────────────────────────────

export interface RabbitDailyRecord extends BaseDailyRecord {
  mortalityCount: number
  mortalityCause?: string
  feedConsumedKg: number
  feedType?: string
  waterConsumedLiters?: number
  birthCount?: number            // Kittens born
  weanCount?: number             // Kittens weaned
  matingCount?: number
  avgBodyWeightSampleKg?: number
}

// ── Custom Animal ─────────────────────────────────────────────────────────────

/**
 * Flexible record for any unlisted species. Three named metric slots allow
 * operators to track species-specific KPIs (e.g. wool weight, egg count,
 * milk yield) without a rigid schema.
 */
export interface CustomAnimalDailyRecord extends BaseDailyRecord {
  /** User-defined species label (e.g. "Goat", "Ostrich", "Turkey") */
  animalType?: string
  mortalityCount?: number
  mortalityCause?: string
  feedConsumedKg?: number
  feedTypeName?: string
  waterConsumedLiters?: number
  /** Net change in head count (positive = births/purchases, negative = deaths/sales) */
  headCountChange?: number
  metric1Name?: string
  metric1Value?: number
  metric2Name?: string
  metric2Value?: number
  metric3Name?: string
  metric3Value?: number
  healthNotes?: string
}

// ── Crop ──────────────────────────────────────────────────────────────────────

export type CropActivityType =
  | 'planting'
  | 'fertilizing'
  | 'spraying'
  | 'weeding'
  | 'irrigating'
  | 'harvesting'
  | 'scouting'
  | 'other'

export interface CropActivityRecord extends BaseDailyRecord {
  activityType: CropActivityType
  inputUsed?: string
  inputQuantity?: number
  inputUnit?: string
  laborHours?: number
  workerCount?: number
  harvestQuantityKg?: number
  harvestGrade?: string
  growthStage?: string
  pestOrDisease?: string
  severity?: 'low' | 'medium' | 'high'
}
