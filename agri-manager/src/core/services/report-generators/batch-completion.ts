import { db } from '../../database/db'
import { differenceInDays, parseISO } from 'date-fns'

export interface BatchCompletionKpi {
  enterpriseId: string
  enterpriseName: string
  enterpriseType: string
  startDate: string
  endDate: string
  durationDays: number
  initialStock: number
  finalStock: number
  mortalityCount: number
  mortalityPct: number
  totalFeedKg: number
  totalEggs?: number
  avgEggWeight?: number
  finalAvgWeightKg?: number
  fcr?: number
  totalMilkLiters?: number
  totalRevenue: number
  totalCosts: number
  netProfit: number
  profitMarginPct: number
}

export interface BatchCompletionReport {
  generatedAt: string
  farmName: string
  dateRange: { from: string; to: string }
  batches: BatchCompletionKpi[]
  summary: {
    totalBatches: number
    avgProfitMarginPct: number
    totalRevenue: number
    totalCosts: number
    totalNetProfit: number
  }
}

export async function generateBatchCompletionReport(
  orgId: string,
  dateRange: { from: string; to: string },
  farmName: string,
): Promise<BatchCompletionReport> {
  const farmLocations = await db.farmLocations
    .where('organizationId')
    .equals(orgId)
    .toArray()
  const locationIds = new Set(farmLocations.map((l) => l.id))

  const allInfrastructures = await db.infrastructures.toArray()
  const orgInfras = allInfrastructures.filter((i) => locationIds.has(i.farmLocationId))
  const infraIds = new Set(orgInfras.map((i) => i.id))

  const allInstances = await db.enterpriseInstances.toArray()
  const relevantInstances = allInstances.filter((inst) => {
    if (!infraIds.has(inst.infrastructureId)) return false
    const endDate = inst.actualEndDate ?? inst.expectedEndDate ?? inst.startDate
    const inStart = inst.startDate >= dateRange.from && inst.startDate <= dateRange.to
    const inEnd = endDate >= dateRange.from && endDate <= dateRange.to
    return inStart || inEnd
  })

  const batches: BatchCompletionKpi[] = []

  for (const inst of relevantInstances) {
    const endDate = inst.actualEndDate ?? inst.expectedEndDate ?? inst.startDate
    const durationDays = Math.max(
      1,
      differenceInDays(parseISO(endDate), parseISO(inst.startDate)),
    )

    const type = inst.enterpriseType.toLowerCase()
    let totalFeedKg = 0
    let mortalityCount = 0
    let totalEggs: number | undefined
    let finalAvgWeightKg: number | undefined
    let totalMilkLiters: number | undefined

    if (type.includes('layer')) {
      const records = await db.layerDailyRecords
        .where('enterpriseInstanceId')
        .equals(inst.id)
        .toArray()
      totalFeedKg = records.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
      mortalityCount = records.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
      totalEggs = records.reduce((s, r) => s + (r.totalEggs ?? 0), 0)
    } else if (type.includes('broiler')) {
      const records = await db.broilerDailyRecords
        .where('enterpriseInstanceId')
        .equals(inst.id)
        .toArray()
      totalFeedKg = records.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
      mortalityCount = records.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
      const withWeight = records
        .filter((r) => r.bodyWeightSampleAvg != null)
        .sort((a, b) => b.date.localeCompare(a.date))
      finalAvgWeightKg = withWeight[0]?.bodyWeightSampleAvg ?? undefined
    } else if (type.includes('cattle')) {
      const records = await db.cattleDailyRecords
        .where('enterpriseInstanceId')
        .equals(inst.id)
        .toArray()
      totalFeedKg = records.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
      mortalityCount = records.reduce((s, r) => s + (r.deaths ?? 0), 0)
      totalMilkLiters = records.reduce((s, r) => s + (r.milkYieldLiters ?? 0), 0)
    } else if (type.includes('fish')) {
      const records = await db.fishDailyRecords
        .where('enterpriseInstanceId')
        .equals(inst.id)
        .toArray()
      totalFeedKg = records.reduce((s, r) => s + (r.feedGivenKg ?? 0), 0)
      mortalityCount = records.reduce((s, r) => s + (r.estimatedMortality ?? 0), 0)
    } else if (type.includes('pig') || type.includes('swine')) {
      const records = await db.pigDailyRecords
        .where('enterpriseInstanceId')
        .equals(inst.id)
        .toArray()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalFeedKg = records.reduce((s, r: any) => s + (r.feedConsumedKg ?? 0), 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mortalityCount = records.reduce((s, r: any) => s + (r.mortalityCount ?? 0), 0)
    } else if (type.includes('rabbit')) {
      const records = await db.rabbitDailyRecords
        .where('enterpriseInstanceId')
        .equals(inst.id)
        .toArray()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalFeedKg = records.reduce((s, r: any) => s + (r.feedConsumedKg ?? 0), 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mortalityCount = records.reduce((s, r: any) => s + (r.mortalityCount ?? 0), 0)
    }

    const financials = await db.financialTransactions
      .where('enterpriseInstanceId')
      .equals(inst.id)
      .toArray()

    const totalRevenue = financials
      .filter((f) => f.type === 'income')
      .reduce((s, f) => s + f.amount, 0)
    const totalCosts = financials
      .filter((f) => f.type === 'expense')
      .reduce((s, f) => s + f.amount, 0)

    const netProfit = totalRevenue - totalCosts
    const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const mortalityPct =
      inst.initialStockCount > 0 ? (mortalityCount / inst.initialStockCount) * 100 : 0

    let fcr: number | undefined
    if (
      type.includes('broiler') &&
      finalAvgWeightKg != null &&
      inst.currentStockCount > 0 &&
      totalFeedKg > 0
    ) {
      const liveWeightKg = inst.currentStockCount * finalAvgWeightKg
      fcr = liveWeightKg > 0 ? Math.round((totalFeedKg / liveWeightKg) * 100) / 100 : undefined
    }

    batches.push({
      enterpriseId: inst.id,
      enterpriseName: inst.name,
      enterpriseType: inst.enterpriseType,
      startDate: inst.startDate,
      endDate,
      durationDays,
      initialStock: inst.initialStockCount,
      finalStock: inst.currentStockCount,
      mortalityCount,
      mortalityPct: Math.round(mortalityPct * 10) / 10,
      totalFeedKg: Math.round(totalFeedKg * 10) / 10,
      totalEggs,
      finalAvgWeightKg:
        finalAvgWeightKg != null ? Math.round(finalAvgWeightKg * 1000) / 1000 : undefined,
      fcr,
      totalMilkLiters:
        totalMilkLiters != null ? Math.round(totalMilkLiters * 10) / 10 : undefined,
      totalRevenue,
      totalCosts,
      netProfit,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
    })
  }

  const totalRevenue = batches.reduce((s, b) => s + b.totalRevenue, 0)
  const totalCosts = batches.reduce((s, b) => s + b.totalCosts, 0)
  const totalNetProfit = batches.reduce((s, b) => s + b.netProfit, 0)
  const avgProfitMarginPct =
    batches.length > 0
      ? batches.reduce((s, b) => s + b.profitMarginPct, 0) / batches.length
      : 0

  return {
    generatedAt: new Date().toISOString(),
    farmName,
    dateRange,
    batches,
    summary: {
      totalBatches: batches.length,
      avgProfitMarginPct: Math.round(avgProfitMarginPct * 10) / 10,
      totalRevenue,
      totalCosts,
      totalNetProfit,
    },
  }
}
