import { db } from '../../database/db'

export interface PnlLineItem {
  label: string
  amount: number
  isSubtotal?: boolean
  isBold?: boolean
  indent?: number
}

export interface EnterprisePnl {
  enterpriseId: string
  name: string
  revenue: number
  directCosts: number
  grossProfit: number
}

export interface FarmPnlReport {
  generatedAt: string
  farmName: string
  dateRange: { from: string; to: string }
  incomeByCategory: Record<string, number>
  expenseByCategory: Record<string, number>
  totalRevenue: number
  totalExpenses: number
  grossProfit: number
  profitMarginPct: number
  enterpriseBreakdown: EnterprisePnl[]
  lineItems: PnlLineItem[]
}

export async function generateFarmPnlReport(
  orgId: string,
  dateRange: { from: string; to: string },
  farmName: string,
): Promise<FarmPnlReport> {
  // Load all transactions for the org within date range
  const allTransactions = await db.financialTransactions
    .where('organizationId')
    .equals(orgId)
    .toArray()

  const rangeTransactions = allTransactions.filter(
    (t) => t.date >= dateRange.from && t.date <= dateRange.to,
  )

  // Aggregate income by category
  const incomeByCategory: Record<string, number> = {}
  const expenseByCategory: Record<string, number> = {}

  for (const t of rangeTransactions) {
    if (t.type === 'income') {
      incomeByCategory[t.category] = (incomeByCategory[t.category] ?? 0) + t.amount
    } else {
      expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + t.amount
    }
  }

  const totalRevenue = Object.values(incomeByCategory).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(expenseByCategory).reduce((s, v) => s + v, 0)
  const grossProfit = totalRevenue - totalExpenses
  const profitMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // Enterprise breakdown
  const farmLocations = await db.farmLocations
    .where('organizationId')
    .equals(orgId)
    .toArray()
  const locationIds = new Set(farmLocations.map((l) => l.id))

  const allInfrastructures = await db.infrastructures.toArray()
  const orgInfras = allInfrastructures.filter((i) => locationIds.has(i.farmLocationId))
  const infraIds = new Set(orgInfras.map((i) => i.id))

  const allInstances = await db.enterpriseInstances.toArray()
  const orgInstances = allInstances.filter((inst) => infraIds.has(inst.infrastructureId))

  const enterpriseBreakdown: EnterprisePnl[] = []

  for (const inst of orgInstances) {
    const instTxns = rangeTransactions.filter(
      (t) => t.enterpriseInstanceId === inst.id,
    )
    const revenue = instTxns
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const directCosts = instTxns
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    if (revenue > 0 || directCosts > 0) {
      enterpriseBreakdown.push({
        enterpriseId: inst.id,
        name: inst.name,
        revenue,
        directCosts,
        grossProfit: revenue - directCosts,
      })
    }
  }

  enterpriseBreakdown.sort((a, b) => b.grossProfit - a.grossProfit)

  // Build formatted P&L line items
  const lineItems: PnlLineItem[] = []

  lineItems.push({ label: 'REVENUE', amount: 0, isBold: true })
  for (const [cat, amt] of Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1])) {
    lineItems.push({ label: cat, amount: amt, indent: 1 })
  }
  lineItems.push({ label: 'Total Revenue', amount: totalRevenue, isSubtotal: true, isBold: true })

  lineItems.push({ label: 'EXPENSES', amount: 0, isBold: true })
  for (const [cat, amt] of Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])) {
    lineItems.push({ label: cat, amount: amt, indent: 1 })
  }
  lineItems.push({
    label: 'Total Expenses',
    amount: totalExpenses,
    isSubtotal: true,
    isBold: true,
  })

  lineItems.push({
    label: 'NET PROFIT / (LOSS)',
    amount: grossProfit,
    isSubtotal: true,
    isBold: true,
  })
  lineItems.push({
    label: 'Profit Margin',
    amount: Math.round(profitMarginPct * 10) / 10,
    indent: 1,
  })

  return {
    generatedAt: new Date().toISOString(),
    farmName,
    dateRange,
    incomeByCategory,
    expenseByCategory,
    totalRevenue,
    totalExpenses,
    grossProfit,
    profitMarginPct: Math.round(profitMarginPct * 10) / 10,
    enterpriseBreakdown,
    lineItems,
  }
}
