import { db } from '../../database/db'
import { differenceInDays, parseISO } from 'date-fns'

export interface EnterpriseRanking {
  enterpriseId: string
  name: string
  enterpriseType: string
  grossMarginPct: number
  totalRevenue: number
  totalCosts: number
  netProfit: number
  daysActive: number
  rank: number
}

export interface CrossEnterpriseReport {
  generatedAt: string
  farmName: string
  dateRange: { from: string; to: string }
  rankings: EnterpriseRanking[]
  totalFarmRevenue: number
  totalFarmCosts: number
  totalFarmNet: number
}

export async function generateCrossEnterpriseReport(
  orgId: string,
  dateRange: { from: string; to: string },
  farmName: string,
): Promise<CrossEnterpriseReport> {
  const farmLocations = await db.farmLocations
    .where('organizationId')
    .equals(orgId)
    .toArray()
  const locationIds = new Set(farmLocations.map((l) => l.id))

  const allInfrastructures = await db.infrastructures.toArray()
  const orgInfras = allInfrastructures.filter((i) => locationIds.has(i.farmLocationId))
  const infraIds = new Set(orgInfras.map((i) => i.id))

  const allInstances = await db.enterpriseInstances.toArray()
  const activeInstances = allInstances.filter((inst) => {
    if (!infraIds.has(inst.infrastructureId)) return false
    // Include if active during the date range
    const endDate = inst.actualEndDate ?? inst.expectedEndDate ?? dateRange.to
    return inst.startDate <= dateRange.to && endDate >= dateRange.from
  })

  const rankings: Omit<EnterpriseRanking, 'rank'>[] = []

  for (const inst of activeInstances) {
    const endDate = inst.actualEndDate ?? inst.expectedEndDate ?? dateRange.to
    const effectiveStart = inst.startDate > dateRange.from ? inst.startDate : dateRange.from
    const effectiveEnd = endDate < dateRange.to ? endDate : dateRange.to
    const daysActive = Math.max(
      1,
      differenceInDays(parseISO(effectiveEnd), parseISO(effectiveStart)) + 1,
    )

    // Only financials within the date range
    const financials = await db.financialTransactions
      .where('enterpriseInstanceId')
      .equals(inst.id)
      .toArray()

    const rangeFinancials = financials.filter(
      (f) => f.date >= dateRange.from && f.date <= dateRange.to,
    )

    const totalRevenue = rangeFinancials
      .filter((f) => f.type === 'income')
      .reduce((s, f) => s + f.amount, 0)
    const totalCosts = rangeFinancials
      .filter((f) => f.type === 'expense')
      .reduce((s, f) => s + f.amount, 0)

    const netProfit = totalRevenue - totalCosts
    const grossMarginPct =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    rankings.push({
      enterpriseId: inst.id,
      name: inst.name,
      enterpriseType: inst.enterpriseType,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      totalRevenue,
      totalCosts,
      netProfit,
      daysActive,
    })
  }

  // Sort by gross margin descending, assign ranks
  rankings.sort((a, b) => b.grossMarginPct - a.grossMarginPct)
  const ranked: EnterpriseRanking[] = rankings.map((r, i) => ({ ...r, rank: i + 1 }))

  const totalFarmRevenue = ranked.reduce((s, r) => s + r.totalRevenue, 0)
  const totalFarmCosts = ranked.reduce((s, r) => s + r.totalCosts, 0)
  const totalFarmNet = ranked.reduce((s, r) => s + r.netProfit, 0)

  return {
    generatedAt: new Date().toISOString(),
    farmName,
    dateRange,
    rankings: ranked,
    totalFarmRevenue,
    totalFarmCosts,
    totalFarmNet,
  }
}
