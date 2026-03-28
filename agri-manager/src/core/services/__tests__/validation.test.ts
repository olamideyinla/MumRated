import { describe, it, expect } from 'vitest'
import {
  layerDailyRecordSchema,
  broilerDailyRecordSchema,
  fishDailyRecordSchema,
  inventoryTransactionSchema,
  financialTransactionSchema,
} from '../validation'

// ── layerDailyRecordSchema ─────────────────────────────────────────────────────

describe('layerDailyRecordSchema', () => {
  const valid = {
    date: new Date('2024-01-15'),
    totalEggs: 4200,
    brokenEggs: 10,
    rejectEggs: 5,
    mortalityCount: 2,
    mortalityCause: 'disease' as const,
    feedConsumedKg: 250,
    feedType: 'Layer Pellets',
    waterConsumedLiters: 500,
  }

  it('accepts a valid full record', () => {
    expect(layerDailyRecordSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts mortalityCount = 0', () => {
    expect(layerDailyRecordSchema.safeParse({ ...valid, mortalityCount: 0 }).success).toBe(true)
  })

  it('rejects negative totalEggs', () => {
    expect(layerDailyRecordSchema.safeParse({ ...valid, totalEggs: -1 }).success).toBe(false)
  })

  it('rejects date as string (must be Date object)', () => {
    expect(layerDailyRecordSchema.safeParse({ ...valid, date: '2024-01-15' }).success).toBe(false)
  })

  it('rejects unknown mortalityCause', () => {
    expect(layerDailyRecordSchema.safeParse({ ...valid, mortalityCause: 'heat_stroke' }).success).toBe(false)
  })

  it('accepts optional temperatureHigh = undefined', () => {
    const data = { ...valid, temperatureHigh: undefined }
    expect(layerDailyRecordSchema.safeParse(data).success).toBe(true)
  })
})

// ── broilerDailyRecordSchema ───────────────────────────────────────────────────

describe('broilerDailyRecordSchema', () => {
  const valid = {
    date: new Date('2024-01-15'),
    mortalityCount: 3,
    mortalityCause: 'injury' as const,
    feedConsumedKg: 300,
    feedType: 'Broiler Finisher',
    waterConsumedLiters: 600,
  }

  it('accepts bodyWeightSampleAvg = undefined (optional)', () => {
    expect(broilerDailyRecordSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects non-integer mortalityCount', () => {
    expect(broilerDailyRecordSchema.safeParse({ ...valid, mortalityCount: 1.5 }).success).toBe(false)
  })

  it('rejects negative feedConsumedKg', () => {
    expect(broilerDailyRecordSchema.safeParse({ ...valid, feedConsumedKg: -1 }).success).toBe(false)
  })

  it('accepts bodyWeightSampleSize = 0 (valid integer)', () => {
    expect(broilerDailyRecordSchema.safeParse({ ...valid, bodyWeightSampleSize: 0 }).success).toBe(true)
  })
})

// ── fishDailyRecordSchema — water parameter boundaries ────────────────────────

describe('fishDailyRecordSchema water boundaries', () => {
  const base = {
    date: new Date('2024-01-15'),
    feedGivenKg: 50,
    feedType: 'Fish Pellets',
    estimatedMortality: 0,
  }

  it('waterTemp: valid at 0', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterTemp: 0 }).success).toBe(true)
  })

  it('waterTemp: valid at 50', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterTemp: 50 }).success).toBe(true)
  })

  it('waterTemp: invalid below 0', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterTemp: -0.1 }).success).toBe(false)
  })

  it('waterTemp: invalid above 50', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterTemp: 50.1 }).success).toBe(false)
  })

  it('waterPh: valid at 0', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterPh: 0 }).success).toBe(true)
  })

  it('waterPh: valid at 14', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterPh: 14 }).success).toBe(true)
  })

  it('waterPh: invalid below 0', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterPh: -0.1 }).success).toBe(false)
  })

  it('waterPh: invalid above 14', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, waterPh: 14.1 }).success).toBe(false)
  })

  it('dissolvedOxygen: valid at 20', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, dissolvedOxygen: 20 }).success).toBe(true)
  })

  it('dissolvedOxygen: invalid above 20', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, dissolvedOxygen: 20.1 }).success).toBe(false)
  })

  it('ammonia: valid at 0', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, ammonia: 0 }).success).toBe(true)
  })

  it('ammonia: invalid below 0', () => {
    expect(fishDailyRecordSchema.safeParse({ ...base, ammonia: -0.01 }).success).toBe(false)
  })
})

// ── inventoryTransactionSchema ─────────────────────────────────────────────────

describe('inventoryTransactionSchema', () => {
  const valid = {
    inventoryItemId: 'item-1',
    type: 'stock_in' as const,
    quantity: 100,
    date: new Date('2024-01-15'),
  }

  it('type "receive" is invalid', () => {
    expect(inventoryTransactionSchema.safeParse({ ...valid, type: 'receive' }).success).toBe(false)
  })

  it('quantity = 0 is invalid (min 0.001)', () => {
    expect(inventoryTransactionSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false)
  })

  it('quantity = 0.001 is valid (minimum)', () => {
    expect(inventoryTransactionSchema.safeParse({ ...valid, quantity: 0.001 }).success).toBe(true)
  })

  it('type "stock_in" is valid', () => {
    expect(inventoryTransactionSchema.safeParse(valid).success).toBe(true)
  })

  it('type "stock_out" is valid', () => {
    expect(inventoryTransactionSchema.safeParse({ ...valid, type: 'stock_out' }).success).toBe(true)
  })

  it('type "adjustment" is valid', () => {
    expect(inventoryTransactionSchema.safeParse({ ...valid, type: 'adjustment' }).success).toBe(true)
  })
})

// ── financialTransactionSchema ─────────────────────────────────────────────────

describe('financialTransactionSchema', () => {
  const valid = {
    date: new Date('2024-01-15'),
    type: 'income' as const,
    category: 'sales_eggs',
    amount: 5000,
    paymentMethod: 'cash' as const,
  }

  it('paymentMethod "credit_card" is invalid (must use "credit")', () => {
    expect(financialTransactionSchema.safeParse({ ...valid, paymentMethod: 'credit_card' }).success).toBe(false)
  })

  it('amount = 0 is invalid', () => {
    expect(financialTransactionSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false)
  })

  it('amount = 0.01 is valid (minimum)', () => {
    expect(financialTransactionSchema.safeParse({ ...valid, amount: 0.01 }).success).toBe(true)
  })

  it('type "revenue" is invalid', () => {
    expect(financialTransactionSchema.safeParse({ ...valid, type: 'revenue' }).success).toBe(false)
  })

  it('paymentMethod "credit" is valid', () => {
    expect(financialTransactionSchema.safeParse({ ...valid, paymentMethod: 'credit' }).success).toBe(true)
  })

  it('paymentMethod "bank_transfer" is valid', () => {
    expect(financialTransactionSchema.safeParse({ ...valid, paymentMethod: 'bank_transfer' }).success).toBe(true)
  })
})

// ── Edge cases ─────────────────────────────────────────────────────────────────

describe('schema edge cases', () => {
  it('null input is invalid for layerDailyRecordSchema', () => {
    expect(layerDailyRecordSchema.safeParse(null).success).toBe(false)
  })

  it('NaN totalEggs is invalid', () => {
    expect(layerDailyRecordSchema.safeParse({
      date: new Date(),
      totalEggs: NaN,
      brokenEggs: 0,
      rejectEggs: 0,
      mortalityCount: 0,
      mortalityCause: 'unknown',
      feedConsumedKg: 0,
      feedType: 'x',
      waterConsumedLiters: 0,
    }).success).toBe(false)
  })
})
