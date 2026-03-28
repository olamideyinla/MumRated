import { db } from './db'
import { newId, nowIso } from '../../shared/types/base'
import type { InventoryCategory } from '../../shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

/** Linear interpolation between sparse checkpoints, producing a dense array */
function interpolateSparse(
  checkpoints: Record<number, number>,
  from: number,
  to: number,
): Array<{ index: number; value: number }> {
  const keys = Object.keys(checkpoints).map(Number).sort((a, b) => a - b)
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const idx = from + i
    if (checkpoints[idx] !== undefined) return { index: idx, value: checkpoints[idx] }
    const lower = keys.filter(k => k <= idx).pop()!
    const upper = keys.find(k => k > idx)!
    const t = (idx - lower) / (upper - lower)
    const v = checkpoints[lower] + t * (checkpoints[upper] - checkpoints[lower])
    return { index: idx, value: Math.round(v * 1000) / 1000 }
  })
}

// ── Broiler weight standards ──────────────────────────────────────────────────

export interface WeightDataPoint {
  day: number
  weightKg: number
}

// Source: Aviagen Ross 308 Performance Objectives (mixed sex average)
const ross308Checkpoints: Record<number, number> = {
  0: 0.042, 7: 0.186, 14: 0.452, 21: 0.835,
  28: 1.331, 35: 1.875, 42: 2.427, 49: 2.967, 56: 3.484,
}

// Source: Cobb 500 Broiler Performance & Nutrition Supplement (mixed sex average)
const cobb500Checkpoints: Record<number, number> = {
  0: 0.042, 7: 0.194, 14: 0.467, 21: 0.859,
  28: 1.352, 35: 1.893, 42: 2.441, 49: 2.989, 56: 3.487,
}

export const ROSS_308_WEIGHTS: WeightDataPoint[] = interpolateSparse(
  ross308Checkpoints, 0, 56,
).map(p => ({ day: p.index, weightKg: p.value }))

export const COBB_500_WEIGHTS: WeightDataPoint[] = interpolateSparse(
  cobb500Checkpoints, 0, 56,
).map(p => ({ day: p.index, weightKg: p.value }))

/** Interpolate expected weight for any day using Ross 308 standard */
export function ross308WeightForDay(day: number): number | null {
  if (day < 0 || day > 56) return null
  const point = ROSS_308_WEIGHTS[day]
  return point?.weightKg ?? null
}

/** Interpolate expected weight for any day using Cobb 500 standard */
export function cobb500WeightForDay(day: number): number | null {
  if (day < 0 || day > 56) return null
  const point = COBB_500_WEIGHTS[day]
  return point?.weightKg ?? null
}

// ── Layer production standards ────────────────────────────────────────────────

export interface LayerProductionPoint {
  week: number
  productionPct: number
}

// Source: Hy-Line Brown Commercial Management Guide (Hen-Day Production %)
// Checkpoints at even weeks; odd weeks are linearly interpolated
const hylineBrownCheckpoints: Record<number, number> = {
  18: 3,  20: 25, 22: 70, 24: 88, 26: 93, 28: 95, 30: 95,
  32: 94, 34: 93, 36: 92, 38: 91, 40: 90, 42: 88, 44: 87,
  46: 86, 48: 84, 50: 83, 52: 81, 54: 80, 56: 78, 58: 76,
  60: 74, 62: 72, 64: 70, 66: 68, 68: 66, 70: 64, 72: 62,
  74: 60, 76: 58, 78: 56, 80: 54,
}

// Source: ISA Brown Management Guide
const isaBrownCheckpoints: Record<number, number> = {
  18: 2,  20: 28, 22: 72, 24: 89, 26: 93, 28: 94, 30: 94,
  32: 93, 34: 92, 36: 91, 38: 90, 40: 89, 42: 87, 44: 86,
  46: 84, 48: 83, 50: 82, 52: 80, 54: 78, 56: 77, 58: 75,
  60: 73, 62: 71, 64: 69, 66: 67, 68: 65, 70: 63, 72: 61,
  74: 59, 76: 57, 78: 55, 80: 53,
}

export const HYLINE_BROWN_PRODUCTION: LayerProductionPoint[] = interpolateSparse(
  hylineBrownCheckpoints, 18, 80,
).map(p => ({ week: p.index, productionPct: p.value }))

export const ISA_BROWN_PRODUCTION: LayerProductionPoint[] = interpolateSparse(
  isaBrownCheckpoints, 18, 80,
).map(p => ({ week: p.index, productionPct: p.value }))

/** Expected Hy-Line Brown HDP% for a given flock age in weeks */
export function hylineProductionForWeek(week: number): number | null {
  if (week < 18 || week > 80) return null
  const point = HYLINE_BROWN_PRODUCTION.find(p => p.week === week)
  return point?.productionPct ?? null
}

// ── Alert thresholds ──────────────────────────────────────────────────────────

export const DEFAULT_ALERT_THRESHOLDS = {
  layers: {
    productionDropPts: 3.0,      // Percentage points drop triggers alert
    minHdpForDrop: 60.0,         // Only alert if HDP was at least this
    mortalityMinBirds: 3,
    mortalityPct: 0.001,         // 0.1% of flock
    feedDeviationPct: 0.20,      // 20% deviation from 7-day average
  },
  broilers: {
    mortalityMinBirds: 3,
    mortalityPct: 0.0015,        // 0.15% of batch
    weightBehindPct: 0.10,       // 10% below standard
    nearMarketDays: 5,
  },
  fish: {
    doLow: 3.0,                  // mg/L dissolved oxygen critical level
    ammoniaHigh: 0.5,            // mg/L
    phMin: 6.5,
    phMax: 9.0,
    tempMin: 18,                 // °C
    tempMax: 32,                 // °C
  },
  cattle_dairy: {
    milkDropPct: 0.15,           // 15% drop from previous week average
    mortalityCount: 1,
  },
  cattle_beef: {
    mortalityCount: 1,
  },
  pigs: {
    mortalityPct: 0.002,         // 0.2%
    feedDeviationPct: 0.25,
  },
  inventory: {
    projectedStockoutDays: 5,    // Warn when estimated days of stock ≤ 5
  },
  operational: {
    missingDataAfterHour: 18,    // Alert if no entry by 6 PM
    batchNearingEndDays: 7,      // Warn 7 days before expected end date
  },
  financial: {
    costPct: 0.90,               // Alert when expenses ≥ 90% of income
    dedupHours: 48,
  },
} as const

// ── Default inventory items ───────────────────────────────────────────────────

export interface DefaultInventoryItem {
  category: InventoryCategory
  name: string
  unitOfMeasurement: string
  reorderPoint?: number
  reorderQuantity?: number
}

export const DEFAULT_INVENTORY_ITEMS: DefaultInventoryItem[] = [
  // Feed
  { category: 'feed', name: 'Layer Mash',            unitOfMeasurement: 'kg',    reorderPoint: 100, reorderQuantity: 500 },
  { category: 'feed', name: 'Layer Pellets',          unitOfMeasurement: 'kg',    reorderPoint: 100, reorderQuantity: 500 },
  { category: 'feed', name: 'Broiler Starter',        unitOfMeasurement: 'kg',    reorderPoint: 50,  reorderQuantity: 300 },
  { category: 'feed', name: 'Broiler Grower',         unitOfMeasurement: 'kg',    reorderPoint: 50,  reorderQuantity: 300 },
  { category: 'feed', name: 'Broiler Finisher',       unitOfMeasurement: 'kg',    reorderPoint: 50,  reorderQuantity: 300 },
  { category: 'feed', name: 'Fish Pellets',           unitOfMeasurement: 'kg',    reorderPoint: 20,  reorderQuantity: 100 },
  { category: 'feed', name: 'Cattle Hay/Fodder',      unitOfMeasurement: 'kg',    reorderPoint: 200, reorderQuantity: 1000 },
  { category: 'feed', name: 'Pig Grower Feed',        unitOfMeasurement: 'kg',    reorderPoint: 50,  reorderQuantity: 300 },
  // Medication
  { category: 'medication', name: 'Newcastle Vaccine',        unitOfMeasurement: 'doses', reorderPoint: 100 },
  { category: 'medication', name: 'Gumboro (IBD) Vaccine',    unitOfMeasurement: 'doses', reorderPoint: 100 },
  { category: 'medication', name: 'Marek\'s Disease Vaccine', unitOfMeasurement: 'doses', reorderPoint: 100 },
  { category: 'medication', name: 'Vitamins & Electrolytes',  unitOfMeasurement: 'kg',    reorderPoint: 2 },
  { category: 'medication', name: 'Antibiotics (Oxytet)',     unitOfMeasurement: 'g',     reorderPoint: 200 },
  { category: 'medication', name: 'Coccidiosis Treatment',    unitOfMeasurement: 'liters', reorderPoint: 1 },
  // Chemicals
  { category: 'chemical', name: 'Disinfectant (Virkon)',  unitOfMeasurement: 'liters', reorderPoint: 5 },
  { category: 'chemical', name: 'Insecticide',            unitOfMeasurement: 'liters', reorderPoint: 2 },
  { category: 'chemical', name: 'Rodenticide',            unitOfMeasurement: 'kg',     reorderPoint: 1 },
  // Fertilizers
  { category: 'fertilizer', name: 'NPK Fertilizer (20-20-20)', unitOfMeasurement: 'kg', reorderPoint: 50, reorderQuantity: 200 },
  { category: 'fertilizer', name: 'Urea (46-0-0)',              unitOfMeasurement: 'kg', reorderPoint: 50, reorderQuantity: 200 },
  { category: 'fertilizer', name: 'DAP (18-46-0)',              unitOfMeasurement: 'kg', reorderPoint: 50 },
  // Seeds
  { category: 'seed', name: 'Maize Seed',     unitOfMeasurement: 'kg', reorderPoint: 5 },
  { category: 'seed', name: 'Soybean Seed',   unitOfMeasurement: 'kg', reorderPoint: 5 },
  { category: 'seed', name: 'Sorghum Seed',   unitOfMeasurement: 'kg', reorderPoint: 5 },
  // Fuel
  { category: 'fuel', name: 'Diesel',  unitOfMeasurement: 'liters', reorderPoint: 50, reorderQuantity: 200 },
  { category: 'fuel', name: 'Petrol',  unitOfMeasurement: 'liters', reorderPoint: 20, reorderQuantity: 100 },
  // Packaging
  { category: 'packaging', name: 'Egg Trays (30-count)', unitOfMeasurement: 'pcs', reorderPoint: 100, reorderQuantity: 500 },
  { category: 'packaging', name: 'Poultry Bags',         unitOfMeasurement: 'pcs', reorderPoint: 50,  reorderQuantity: 200 },
  { category: 'packaging', name: 'Fish Bags',            unitOfMeasurement: 'pcs', reorderPoint: 50 },
]

// ── Initial data seed ─────────────────────────────────────────────────────────

/**
 * Seeds the database with the initial organization, farm location, and user.
 * Called once after sign-up.
 */
export async function seedInitialData(params: {
  userId: string
  email: string
  fullName: string
  orgName: string
  currency?: string
}): Promise<{ orgId: string; locationId: string }> {
  const ts = nowIso()
  const orgId = newId()
  const locationId = newId()

  await db.transaction('rw', [db.organizations, db.farmLocations, db.appUsers], async () => {
    await db.organizations.add({
      id: orgId,
      name: params.orgName,
      currency: params.currency ?? 'USD',
      defaultUnitSystem: 'metric',
      syncStatus: 'pending',
      createdAt: ts,
      updatedAt: ts,
    })

    await db.farmLocations.add({
      id: locationId,
      organizationId: orgId,
      name: `${params.orgName} Farm`,
      status: 'active',
      syncStatus: 'pending',
      createdAt: ts,
      updatedAt: ts,
    })

    await db.appUsers.add({
      id: params.userId,
      organizationId: orgId,
      email: params.email,
      fullName: params.fullName,
      role: 'owner',
      assignedFarmLocationIds: [locationId],
      assignedInfrastructureIds: [],
      isActive: true,
      syncStatus: 'pending',
      createdAt: ts,
      updatedAt: ts,
    })
  })

  return { orgId, locationId }
}

// Export today helper for convenience
export { today }
