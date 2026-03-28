import { db } from '../../database/db'
import { subDays, format } from 'date-fns'

export interface InventoryItemStatus {
  itemId: string
  name: string
  category: string
  currentStock: number
  unit: string
  reorderPoint?: number
  avgDailyConsumption: number
  daysRemaining: number
  totalValueIn: number
  status: 'adequate' | 'low' | 'critical' | 'out'
}

export interface InventoryStatusReport {
  generatedAt: string
  farmName: string
  asOfDate: string
  items: InventoryItemStatus[]
  totalItems: number
  lowStockCount: number
  outOfStockCount: number
  totalInventoryValue: number
}

function deriveStatus(
  currentStock: number,
  reorderPoint: number | undefined,
  avgDailyConsumption: number,
): 'adequate' | 'low' | 'critical' | 'out' {
  if (currentStock <= 0) return 'out'
  if (reorderPoint != null && currentStock <= reorderPoint) {
    const daysLeft = avgDailyConsumption > 0 ? currentStock / avgDailyConsumption : Infinity
    return daysLeft <= 3 ? 'critical' : 'low'
  }
  return 'adequate'
}

export async function generateInventoryStatusReport(
  orgId: string,
  farmName: string,
): Promise<InventoryStatusReport> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const inventoryItems = await db.inventoryItems
    .where('organizationId')
    .equals(orgId)
    .toArray()

  const allTransactions = await db.inventoryTransactions.toArray()

  const itemStatuses: InventoryItemStatus[] = []

  for (const item of inventoryItems) {
    const itemTxns = allTransactions.filter((t) => t.inventoryItemId === item.id)

    // Consumption over last 30 days (stockOut transactions)
    const recentOuts = itemTxns.filter(
      (t) => t.type === 'out' && t.date >= thirtyDaysAgo && t.date <= today,
    )
    const totalOutLast30 = recentOuts.reduce((s, t) => s + Math.abs(t.quantity), 0)
    const avgDailyConsumption = totalOutLast30 / 30

    const daysRemaining =
      avgDailyConsumption > 0 ? item.currentStock / avgDailyConsumption : 0

    // Total value from stockIn transactions (quantity * unitCost)
    const stockIns = itemTxns.filter((t) => t.type === 'in')
    const totalValueIn = stockIns.reduce(
      (s, t) => s + t.quantity * (t.unitCost ?? 0),
      0,
    )

    const status = deriveStatus(item.currentStock, item.reorderPoint, avgDailyConsumption)

    itemStatuses.push({
      itemId: item.id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      unit: item.unitOfMeasurement,
      reorderPoint: item.reorderPoint,
      avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
      daysRemaining: Math.round(daysRemaining * 10) / 10,
      totalValueIn: Math.round(totalValueIn * 100) / 100,
      status,
    })
  }

  // Sort: out first, then critical, then low, then adequate; within group by name
  const statusOrder: Record<string, number> = { out: 0, critical: 1, low: 2, adequate: 3 }
  itemStatuses.sort((a, b) => {
    const diff = statusOrder[a.status] - statusOrder[b.status]
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  const lowStockCount = itemStatuses.filter(
    (i) => i.status === 'low' || i.status === 'critical',
  ).length
  const outOfStockCount = itemStatuses.filter((i) => i.status === 'out').length

  // Total inventory value = current stock * last known unit cost (from most recent stockIn)
  const totalInventoryValue = itemStatuses.reduce((s, item) => {
    // Simple: use totalValueIn as proxy; in production you'd compute average cost
    return s + item.totalValueIn
  }, 0)

  return {
    generatedAt: new Date().toISOString(),
    farmName,
    asOfDate: today,
    items: itemStatuses,
    totalItems: itemStatuses.length,
    lowStockCount,
    outOfStockCount,
    totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
  }
}
