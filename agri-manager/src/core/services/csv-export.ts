import { arrayToCsv } from './export-csv'
import { downloadBlob } from '../../shared/utils/file-download'
import { db } from '../database/db'
import type { EnterpriseType } from '../../shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBlob(csv: string): Blob {
  return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ── exportToCSV ───────────────────────────────────────────────────────────────

export function exportToCSV(headers: string[], rows: unknown[][], filename: string): void {
  const csv = arrayToCsv(headers, rows as string[][])
  downloadBlob(toBlob(csv), filename)
}

// ── exportDailyRecords ────────────────────────────────────────────────────────

export async function exportDailyRecords(
  enterpriseId: string,
  enterpriseType: EnterpriseType,
  dateRange: { from: string; to: string },
): Promise<void> {
  const { from, to } = dateRange

  const byCompound = (table: any): Promise<any[]> =>
    table
      .where('[enterpriseInstanceId+date]')
      .between([enterpriseId, from], [enterpriseId, to], true, true)
      .toArray()

  let headers: string[]
  let rows: string[][]

  switch (enterpriseType) {
    case 'layers': {
      const recs = await byCompound(db.layerDailyRecords)
      headers = ['Date', 'Total Eggs', 'Broken Eggs', 'Reject Eggs', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Temp High', 'Temp Low', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.totalEggs, r.brokenEggs ?? '', r.rejectEggs ?? '', r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.temperatureHigh ?? '', r.temperatureLow ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'broilers': {
      const recs = await byCompound(db.broilerDailyRecords)
      headers = ['Date', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Avg Body Weight (kg)', 'Sample Size', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.bodyWeightSampleAvg ?? '', r.bodyWeightSampleSize ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'cattle_dairy':
    case 'cattle_beef': {
      const recs = await byCompound(db.cattleDailyRecords)
      headers = ['Date', 'Milk Yield (L)', 'Milkings', 'Feed (kg)', 'Feed Type', 'Deaths', 'Births', 'Health Notes', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.milkYieldLiters ?? '', r.milkingCount ?? '', r.feedConsumedKg ?? '', r.feedType ?? '', r.deaths ?? '', r.births ?? '', r.healthNotes ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'fish': {
      const recs = await byCompound(db.fishDailyRecords)
      headers = ['Date', 'Feed (kg)', 'Feed Type', 'Estimated Mortality', 'Water Temp (°C)', 'pH', 'DO (mg/L)', 'Ammonia (mg/L)', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.feedGivenKg, r.feedType ?? '', r.estimatedMortality ?? '', r.waterTemp ?? '', r.waterPh ?? '', r.dissolvedOxygen ?? '', r.ammonia ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'pigs_breeding':
    case 'pigs_growfinish': {
      const recs = await byCompound(db.pigDailyRecords)
      headers = ['Date', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Births', 'Weaned', 'Avg Weight (kg)', 'Health Notes', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.birthCount ?? '', r.weanCount ?? '', r.avgBodyWeightSampleKg ?? '', r.healthNotes ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'rabbit': {
      const recs = await byCompound(db.rabbitDailyRecords)
      headers = ['Date', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Births', 'Weaned', 'Matings', 'Avg Weight (kg)', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.birthCount ?? '', r.weanCount ?? '', r.matingCount ?? '', r.avgBodyWeightSampleKg ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'custom_animal': {
      const recs = await byCompound(db.customAnimalDailyRecords)
      headers = ['Date', 'Animal Type', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Head Count Change', 'Metric 1 Name', 'Metric 1 Value', 'Metric 2 Name', 'Metric 2 Value', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.animalType ?? '', r.mortalityCount ?? '', r.mortalityCause ?? '', r.feedConsumedKg ?? '', r.feedTypeName ?? '', r.waterConsumedLiters ?? '', r.headCountChange ?? '', r.metric1Name ?? '', r.metric1Value ?? '', r.metric2Name ?? '', r.metric2Value ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    case 'crop_annual':
    case 'crop_perennial': {
      const all = await db.cropActivityRecords.where('enterpriseInstanceId').equals(enterpriseId).toArray()
      const recs = all.filter(r => r.date >= from && r.date <= to)
      headers = ['Date', 'Activity Type', 'Input Used', 'Input Qty', 'Input Unit', 'Labor Hours', 'Workers', 'Harvest Qty (kg)', 'Harvest Grade', 'Growth Stage', 'Pest/Disease', 'Severity', 'Notes', 'Sync Status']
      rows = recs.map(r => [r.date, r.activityType, r.inputUsed ?? '', r.inputQuantity ?? '', r.inputUnit ?? '', r.laborHours ?? '', r.workerCount ?? '', r.harvestQuantityKg ?? '', r.harvestGrade ?? '', r.growthStage ?? '', r.pestOrDisease ?? '', r.severity ?? '', r.notes ?? '', r.syncStatus].map(String))
      break
    }
    default:
      return
  }

  const enterprise = await db.enterpriseInstances.get(enterpriseId)
  const name = (enterprise?.name ?? 'enterprise').replace(/ /g, '-')
  const filename = `records-${name}-${from}-to-${to}.csv`
  exportToCSV(headers, rows, filename)
}

// ── exportFinancialTransactions ───────────────────────────────────────────────

export async function exportFinancialTransactions(
  orgId: string,
  dateRange: { from: string; to: string },
  enterpriseId?: string,
): Promise<void> {
  const { from, to } = dateRange
  let txns = await db.financialTransactions
    .where('organizationId').equals(orgId)
    .filter(t => t.date >= from && t.date <= to)
    .toArray()

  if (enterpriseId) {
    txns = txns.filter(t => t.enterpriseInstanceId === enterpriseId)
  }

  txns.sort((a, b) => a.date.localeCompare(b.date))

  const headers = ['Date', 'Type', 'Category', 'Amount', 'Payment Method', 'Reference', 'Notes']
  const rows = txns.map(t => [
    t.date,
    t.type,
    t.category.replace(/_/g, ' '),
    t.amount.toFixed(2),
    t.paymentMethod.replace(/_/g, ' '),
    t.reference ?? '',
    t.notes ?? '',
  ])

  const suffix = enterpriseId ? `-enterprise` : ''
  downloadBlob(toBlob(arrayToCsv(headers, rows)), `transactions${suffix}-${from}-to-${to}.csv`)
}

// ── exportInventoryReport ─────────────────────────────────────────────────────

export async function exportInventoryReport(orgId: string): Promise<void> {
  const items = await db.inventoryItems.where('organizationId').equals(orgId).toArray()
  const itemIds = new Set(items.map(i => i.id))

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const allTxns = await db.inventoryTransactions.where('date').aboveOrEqual(cutoffStr).toArray()
  const txns = allTxns.filter(t => itemIds.has(t.inventoryItemId))
  txns.sort((a, b) => b.date.localeCompare(a.date))

  const itemMap = new Map(items.map(i => [i.id, i]))

  const stockHeaders = ['Name', 'Category', 'Current Stock', 'Unit', 'Reorder Point', 'Reorder Qty']
  const stockRows = items.map(item => [
    item.name,
    item.category,
    item.currentStock.toString(),
    item.unitOfMeasurement,
    item.reorderPoint != null ? String(item.reorderPoint) : '',
    item.reorderQuantity != null ? String(item.reorderQuantity) : '',
  ])

  const txnHeaders = ['Date', 'Item', 'Category', 'Type', 'Quantity', 'Unit Cost', 'Reference', 'Notes']
  const txnRows = txns.map(t => {
    const item = itemMap.get(t.inventoryItemId)
    return [
      t.date,
      item?.name ?? '',
      item?.category ?? '',
      t.type,
      t.quantity.toString(),
      t.unitCost != null ? t.unitCost.toFixed(2) : '',
      t.reference ?? '',
      t.notes ?? '',
    ]
  })

  // Combine with blank row separator
  const stockCsv = arrayToCsv(stockHeaders, stockRows)
  const txnCsv = arrayToCsv(txnHeaders, txnRows)
  const combined = `Current Stock\n${stockCsv}\n\nMovements (Last 90 Days)\n${txnCsv}`

  downloadBlob(toBlob(combined), `inventory-report-${todayStr()}.csv`)
}
