import { describe, it, expect } from 'vitest'
import {
  henDayProductionPct,
  layerCumulativeMortalityPct,
  layerFeedConversionRatio,
  broilerFcr,
  broilerSurvivalPct,
  ross308WeightForDay,
  netProfit,
  profitMarginPct,
} from '../kpi-calculator'
import type { LayerDailyRecord, BroilerDailyRecord } from '../../../shared/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeLayerRecord(eggs: number, mortality: number, feed: number): LayerDailyRecord {
  return {
    id: 'x', enterpriseInstanceId: 'e', date: '2024-01-01', recordedBy: 'u',
    totalEggs: eggs, mortalityCount: mortality, feedConsumedKg: feed,
    syncStatus: 'synced', createdAt: '', updatedAt: '',
  }
}

function makeBroilerRecord(feed: number): BroilerDailyRecord {
  return {
    id: 'x', enterpriseInstanceId: 'e', date: '2024-01-01', recordedBy: 'u',
    mortalityCount: 0, feedConsumedKg: feed,
    syncStatus: 'synced', createdAt: '', updatedAt: '',
  }
}

// ── henDayProductionPct ────────────────────────────────────────────────────────

describe('henDayProductionPct', () => {
  it('returns 100.0 when all hens lay', () => {
    expect(henDayProductionPct(5000, 5000)).toBe(100.0)
  })

  it('returns 80.0 for 4000 eggs / 5000 hens', () => {
    expect(henDayProductionPct(4000, 5000)).toBe(80.0)
  })

  it('returns 0.0 when no eggs', () => {
    expect(henDayProductionPct(0, 5000)).toBe(0.0)
  })

  it('is zero-safe: returns 0 when hens = 0', () => {
    expect(henDayProductionPct(0, 0)).toBe(0.0)
  })

  it('can exceed 100 (double-yolk days)', () => {
    expect(henDayProductionPct(5100, 5000)).toBe(102.0)
  })

  it('rounds to 1 decimal: 1 egg / 3000 hens → 0.0', () => {
    expect(henDayProductionPct(1, 3000)).toBe(0.0)
  })

  it('returns 75.0 for 150 eggs / 200 hens', () => {
    expect(henDayProductionPct(150, 200)).toBe(75.0)
  })
})

// ── layerCumulativeMortalityPct ────────────────────────────────────────────────

describe('layerCumulativeMortalityPct', () => {
  it('returns 0 for empty records', () => {
    expect(layerCumulativeMortalityPct([], 5000)).toBe(0)
  })

  it('returns 1.0 for 50 deaths / 5000 initial', () => {
    const records = [makeLayerRecord(0, 50, 0)]
    expect(layerCumulativeMortalityPct(records, 5000)).toBe(1.0)
  })

  it('returns 5.0 for 250 deaths / 5000 initial', () => {
    const records = [makeLayerRecord(0, 250, 0)]
    expect(layerCumulativeMortalityPct(records, 5000)).toBe(5.0)
  })

  it('returns 100.0 when all stock died', () => {
    const records = [makeLayerRecord(0, 5000, 0)]
    expect(layerCumulativeMortalityPct(records, 5000)).toBe(100.0)
  })

  it('sums across multiple records', () => {
    const records = [
      makeLayerRecord(0, 10, 0),
      makeLayerRecord(0, 15, 0),
      makeLayerRecord(0, 25, 0),
    ]
    // 50 deaths / 5000 = 1%
    expect(layerCumulativeMortalityPct(records, 5000)).toBe(1.0)
  })
})

// ── layerFeedConversionRatio ────────────────────────────────────────────────────

describe('layerFeedConversionRatio', () => {
  it('computes FCR: 5×250 kg feed / 700 kg eggs → 1.79', () => {
    const records = Array.from({ length: 5 }, () => makeLayerRecord(0, 0, 250))
    expect(layerFeedConversionRatio(records, 700)).toBe(1.79)
  })

  it('returns 0 when totalEggsKg is 0', () => {
    const records = [makeLayerRecord(0, 0, 500)]
    expect(layerFeedConversionRatio(records, 0)).toBe(0)
  })

  it('returns 1.0 when feed equals eggs weight', () => {
    const records = [makeLayerRecord(0, 0, 1000)]
    expect(layerFeedConversionRatio(records, 1000)).toBe(1.0)
  })

  it('works with a single record', () => {
    const records = [makeLayerRecord(0, 0, 350)]
    expect(layerFeedConversionRatio(records, 700)).toBe(0.5)
  })

  it('returns 0 when zero feed', () => {
    const records = [makeLayerRecord(0, 0, 0)]
    expect(layerFeedConversionRatio(records, 500)).toBe(0)
  })
})

// ── broilerFcr ─────────────────────────────────────────────────────────────────

describe('broilerFcr', () => {
  it('computes FCR: 30000 kg feed / (10000 × 2.5 kg) → 1.20', () => {
    const records = Array.from({ length: 10 }, () => makeBroilerRecord(3000))
    expect(broilerFcr(records, 10000, 2.5)).toBe(1.2)
  })

  it('returns 0 when stockCount is 0', () => {
    const records = [makeBroilerRecord(1000)]
    expect(broilerFcr(records, 0, 2.5)).toBe(0)
  })

  it('returns 0 when avgBodyWeightKg is 0', () => {
    const records = [makeBroilerRecord(1000)]
    expect(broilerFcr(records, 10000, 0)).toBe(0)
  })

  it('works with a single record', () => {
    const records = [makeBroilerRecord(500)]
    // 500 / (1000 × 1.0) = 0.5
    expect(broilerFcr(records, 1000, 1.0)).toBe(0.5)
  })

  it('realistic day-28: 28×300 kg / (9800 × 1.35)', () => {
    const records = Array.from({ length: 28 }, () => makeBroilerRecord(300))
    // 8400 / 13230 ≈ 0.63
    expect(broilerFcr(records, 9800, 1.35)).toBe(0.63)
  })
})

// ── broilerSurvivalPct ─────────────────────────────────────────────────────────

describe('broilerSurvivalPct', () => {
  it('100% when no deaths', () => {
    expect(broilerSurvivalPct(10000, 10000)).toBe(100.0)
  })

  it('95% when 500 deaths from 10000', () => {
    expect(broilerSurvivalPct(10000, 9500)).toBe(95.0)
  })

  it('0% when all birds died', () => {
    expect(broilerSurvivalPct(10000, 0)).toBe(0.0)
  })

  it('zero-safe: returns 0 when initialStock is 0', () => {
    expect(broilerSurvivalPct(0, 0)).toBe(0.0)
  })

  it('rounds small survival to 2 decimals', () => {
    expect(broilerSurvivalPct(10000, 1)).toBe(0.0)
  })
})

// ── ross308WeightForDay ────────────────────────────────────────────────────────

describe('ross308WeightForDay', () => {
  it('day 0 → 0.042 kg (exact key)', () => {
    expect(ross308WeightForDay(0)).toBe(0.042)
  })

  it('day 7 → 0.190 kg (exact key)', () => {
    expect(ross308WeightForDay(7)).toBe(0.190)
  })

  it('day 42 → 2.5 kg (last exact key)', () => {
    expect(ross308WeightForDay(42)).toBe(2.5)
  })

  it('day -1 → null (before range)', () => {
    expect(ross308WeightForDay(-1)).toBeNull()
  })

  it('day 100 → 2.5 kg (capped at max)', () => {
    expect(ross308WeightForDay(100)).toBe(2.5)
  })

  it('day 10 interpolates between 7 and 14: ~0.310 kg', () => {
    // t = (10-7)/(14-7) = 3/7; result = 0.190 + (3/7)*(0.430-0.190) = 0.190 + 0.1029 ≈ 0.293
    const result = ross308WeightForDay(10)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(0.19)
    expect(result!).toBeLessThan(0.43)
  })

  it('day 3 interpolates between 0 and 7', () => {
    // t = 3/7; result = 0.042 + (3/7)*(0.190-0.042) = 0.042 + 0.0634 ≈ 0.105
    const result = ross308WeightForDay(3)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(0.042)
    expect(result!).toBeLessThan(0.190)
  })
})

// ── netProfit ─────────────────────────────────────────────────────────────────

describe('netProfit', () => {
  it('positive profit', () => {
    expect(netProfit(10000, 8000)).toBe(2000)
  })

  it('negative profit (loss)', () => {
    expect(netProfit(5000, 8000)).toBe(-3000)
  })

  it('zero when income = expenses = 0', () => {
    expect(netProfit(0, 0)).toBe(0)
  })

  it('decimal precision', () => {
    expect(netProfit(1000.50, 750.25)).toBe(250.25)
  })

  it('zero when break-even', () => {
    expect(netProfit(5000, 5000)).toBe(0)
  })
})

// ── profitMarginPct ───────────────────────────────────────────────────────────

describe('profitMarginPct', () => {
  it('20% margin on 10000 income, 8000 expenses', () => {
    expect(profitMarginPct(10000, 8000)).toBe(20.0)
  })

  it('returns 0 when income is 0', () => {
    expect(profitMarginPct(0, 5000)).toBe(0)
  })

  it('80% margin on 10000 income, 2000 expenses', () => {
    expect(profitMarginPct(10000, 2000)).toBe(80.0)
  })

  it('negative margin (loss)', () => {
    expect(profitMarginPct(5000, 8000)).toBe(-60.0)
  })

  it('0% at break-even', () => {
    expect(profitMarginPct(5000, 5000)).toBe(0.0)
  })
})
