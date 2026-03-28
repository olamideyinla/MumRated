import { pct, round } from '../utils/number'
import type { LayerDailyRecord, BroilerDailyRecord } from '../../shared/types'
import { Ross308WeightKg } from '../config/constants'

// ── Layer KPIs ─────────────────────────────────────────────────────────────────

export function henDayProductionPct(totalEggs: number, hensOnDay: number): number {
  if (hensOnDay === 0) return 0
  return round(pct(totalEggs, hensOnDay), 1)
}

export function layerCumulativeMortalityPct(
  records: LayerDailyRecord[],
  initialStock: number
): number {
  const total = records.reduce((s, r) => s + r.mortalityCount, 0)
  return round(pct(total, initialStock), 2)
}

export function layerFeedConversionRatio(
  records: LayerDailyRecord[],
  totalEggsKg: number
): number {
  const totalFeed = records.reduce((s, r) => s + r.feedConsumedKg, 0)
  if (totalEggsKg === 0) return 0
  return round(totalFeed / totalEggsKg, 2)
}

// ── Broiler KPIs ───────────────────────────────────────────────────────────────

export function broilerFcr(
  records: BroilerDailyRecord[],
  currentStockCount: number,
  avgBodyWeightKg: number
): number {
  const totalFeed = records.reduce((s, r) => s + r.feedConsumedKg, 0)
  const totalLiveWeightKg = currentStockCount * avgBodyWeightKg
  if (totalLiveWeightKg === 0) return 0
  return round(totalFeed / totalLiveWeightKg, 2)
}

export function broilerSurvivalPct(
  initialStock: number,
  currentStock: number
): number {
  return round(pct(currentStock, initialStock), 1)
}

// ── Ross 308 standard weight interpolation ────────────────────────────────────

export function ross308WeightForDay(day: number): number | null {
  const days = Object.keys(Ross308WeightKg).map(Number).sort((a, b) => a - b)
  if (day < days[0]) return null
  if (day >= days[days.length - 1]) return Ross308WeightKg[days[days.length - 1]]

  for (let i = 0; i < days.length - 1; i++) {
    const d0 = days[i], d1 = days[i + 1]
    if (day >= d0 && day <= d1) {
      const t = (day - d0) / (d1 - d0)
      return round(Ross308WeightKg[d0] + t * (Ross308WeightKg[d1] - Ross308WeightKg[d0]), 3)
    }
  }
  return null
}

// ── Financial KPIs ─────────────────────────────────────────────────────────────

export function netProfit(income: number, expenses: number): number {
  return round(income - expenses, 2)
}

export function profitMarginPct(income: number, expenses: number): number {
  if (income === 0) return 0
  return round(pct(income - expenses, income), 1)
}
