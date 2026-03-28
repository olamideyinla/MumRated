import { z } from 'zod'

// ── Shared schemas ─────────────────────────────────────────────────────────────

export const positiveNumber = z.number().min(0, 'Must be 0 or greater')
export const positiveInt = z.number().int().min(0, 'Must be 0 or greater')
export const dateField = z.date({ error: 'Date is required' })
export const requiredString = z.string().min(1, 'This field is required')

// ── Layer daily record schema ──────────────────────────────────────────────────

export const layerDailyRecordSchema = z.object({
  date: dateField,
  totalEggs: positiveInt,
  brokenEggs: positiveInt,
  rejectEggs: positiveInt,
  mortalityCount: positiveInt,
  mortalityCause: z.enum(['disease', 'predator', 'injury', 'culled', 'unknown', 'other']),
  feedConsumedKg: positiveNumber,
  feedType: requiredString,
  waterConsumedLiters: positiveNumber,
  temperatureHigh: positiveNumber.optional(),
  temperatureLow: positiveNumber.optional(),
  notes: z.string().optional(),
})

// ── Broiler daily record schema ────────────────────────────────────────────────

export const broilerDailyRecordSchema = z.object({
  date: dateField,
  mortalityCount: positiveInt,
  mortalityCause: z.enum(['disease', 'predator', 'injury', 'culled', 'unknown', 'other']),
  feedConsumedKg: positiveNumber,
  feedType: requiredString,
  waterConsumedLiters: positiveNumber,
  bodyWeightSampleAvg: positiveNumber.optional(),
  bodyWeightSampleSize: positiveInt.optional(),
  notes: z.string().optional(),
})

// ── Fish daily record schema ───────────────────────────────────────────────────

export const fishDailyRecordSchema = z.object({
  date: dateField,
  feedGivenKg: positiveNumber,
  feedType: requiredString,
  estimatedMortality: positiveInt,
  waterTemp: z.number().min(0).max(50).optional(),
  waterPh: z.number().min(0).max(14).optional(),
  dissolvedOxygen: z.number().min(0).max(20).optional(),
  ammonia: z.number().min(0).optional(),
  notes: z.string().optional(),
})

// ── Inventory transaction schema ───────────────────────────────────────────────

export const inventoryTransactionSchema = z.object({
  inventoryItemId: requiredString,
  type: z.enum(['stock_in', 'stock_out', 'adjustment']),
  quantity: z.number().min(0.001, 'Quantity must be greater than 0'),
  unitCost: positiveNumber.optional(),
  date: dateField,
  notes: z.string().optional(),
})

// ── Financial transaction schema ───────────────────────────────────────────────

export const financialTransactionSchema = z.object({
  date: dateField,
  type: z.enum(['income', 'expense']),
  category: requiredString,
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'mobile_money', 'cheque', 'credit']),
  enterpriseInstanceId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export type LayerDailyRecordFormData = z.infer<typeof layerDailyRecordSchema>
export type BroilerDailyRecordFormData = z.infer<typeof broilerDailyRecordSchema>
export type FishDailyRecordFormData = z.infer<typeof fishDailyRecordSchema>
export type InventoryTransactionFormData = z.infer<typeof inventoryTransactionSchema>
export type FinancialTransactionFormData = z.infer<typeof financialTransactionSchema>
