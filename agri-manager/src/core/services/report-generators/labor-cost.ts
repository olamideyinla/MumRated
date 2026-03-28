import { db } from '../../database/db'
import { format, eachWeekOfInterval, endOfWeek, parseISO } from 'date-fns'

export interface LaborWorkerRow {
  name: string
  daysWorked: number
  basePay: number
  overtimePay: number
  deductions: number
  netPay: number
}

export interface LaborEnterpriseRow {
  name: string
  permanentCost: number
  casualCost: number
  totalCost: number
}

export interface LaborWeekRow {
  week: string
  permanent: number
  casual: number
  total: number
}

export interface LaborCostReport {
  generatedAt: string
  farmName: string
  dateRange: { from: string; to: string }
  permanentLaborCost: number
  casualLaborCost: number
  totalLaborCost: number
  workerRows: LaborWorkerRow[]
  enterpriseRows: LaborEnterpriseRow[]
  weeklyTotals: LaborWeekRow[]
}

export async function generateLaborCostReport(
  orgId: string,
  dateRange: { from: string; to: string },
  farmName: string,
): Promise<LaborCostReport> {
  const { from, to } = dateRange

  // Load paid payroll entries in date range
  const allWorkers = await db.workers.where('organizationId').equals(orgId).toArray()
  const workerIds  = new Set(allWorkers.map(w => w.id))
  const workerMap  = new Map(allWorkers.map(w => [w.id, w]))

  const allPayroll = await db.payrollEntries.toArray()
  const periodPayroll = allPayroll.filter(
    e => workerIds.has(e.workerId)
      && e.status === 'paid'
      && e.periodEnd >= from
      && e.periodStart <= to,
  )

  // Load casual labor entries
  const casualEntries = await db.casualLaborEntries
    .where('organizationId').equals(orgId)
    .filter(e => e.date >= from && e.date <= to)
    .toArray()

  // Load enterprises for name resolution
  const locs = await db.farmLocations.where('organizationId').equals(orgId).toArray()
  const locIds = new Set(locs.map(l => l.id))
  const infras = await db.infrastructures.toArray()
  const orgInfraIds = new Set(infras.filter(i => locIds.has(i.farmLocationId)).map(i => i.id))
  const enterprises = await db.enterpriseInstances
    .filter(e => orgInfraIds.has(e.infrastructureId))
    .toArray()
  const enterpriseMap = new Map(enterprises.map(e => [e.id, e.name]))

  // Worker rows
  const workerRows: LaborWorkerRow[] = []
  for (const entry of periodPayroll) {
    const worker = workerMap.get(entry.workerId)
    if (!worker) continue
    // Merge multiple payroll entries for same worker
    const existing = workerRows.find(r => r.name === worker.name)
    if (existing) {
      existing.daysWorked  += entry.daysWorked
      existing.basePay     += entry.basePay
      existing.overtimePay += entry.overtimePay
      existing.deductions  += entry.deductions
      existing.netPay      += entry.netPay
    } else {
      workerRows.push({
        name: worker.name,
        daysWorked: entry.daysWorked,
        basePay: entry.basePay,
        overtimePay: entry.overtimePay,
        deductions: entry.deductions,
        netPay: entry.netPay,
      })
    }
  }

  const permanentLaborCost = workerRows.reduce((s, r) => s + r.netPay, 0)
  const casualLaborCost    = casualEntries.reduce((s, e) => s + e.totalCost, 0)
  const totalLaborCost     = permanentLaborCost + casualLaborCost

  // Enterprise rows
  const enterpriseRowMap = new Map<string, LaborEnterpriseRow>()

  for (const entry of periodPayroll) {
    // Payroll not linked to specific enterprise — aggregate under "General"
    const key  = '__general__'
    const name = 'General / Unassigned'
    const row  = enterpriseRowMap.get(key) ?? { name, permanentCost: 0, casualCost: 0, totalCost: 0 }
    row.permanentCost += entry.netPay
    row.totalCost     += entry.netPay
    enterpriseRowMap.set(key, row)
  }

  for (const entry of casualEntries) {
    const entId = entry.enterpriseInstanceId
    const key   = entId ?? '__general__'
    const name  = entId ? (enterpriseMap.get(entId) ?? 'Unknown') : 'General / Unassigned'
    const row   = enterpriseRowMap.get(key) ?? { name, permanentCost: 0, casualCost: 0, totalCost: 0 }
    row.casualCost += entry.totalCost
    row.totalCost  += entry.totalCost
    enterpriseRowMap.set(key, row)
  }

  const enterpriseRows = [...enterpriseRowMap.values()].sort((a, b) => b.totalCost - a.totalCost)

  // Weekly totals
  const weeks = eachWeekOfInterval(
    { start: parseISO(from), end: parseISO(to) },
    { weekStartsOn: 1 },
  )

  const weeklyTotals: LaborWeekRow[] = weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const wFrom = format(weekStart, 'yyyy-MM-dd')
    const wTo   = format(weekEnd,   'yyyy-MM-dd')

    const perm = periodPayroll
      .filter(e => e.periodEnd >= wFrom && e.periodStart <= wTo)
      .reduce((s, e) => s + e.netPay, 0)

    const cas = casualEntries
      .filter(e => e.date >= wFrom && e.date <= wTo)
      .reduce((s, e) => s + e.totalCost, 0)

    return {
      week: `${wFrom} to ${wTo}`,
      permanent: Math.round(perm * 100) / 100,
      casual:    Math.round(cas * 100) / 100,
      total:     Math.round((perm + cas) * 100) / 100,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    farmName,
    dateRange,
    permanentLaborCost: Math.round(permanentLaborCost * 100) / 100,
    casualLaborCost:    Math.round(casualLaborCost * 100) / 100,
    totalLaborCost:     Math.round(totalLaborCost * 100) / 100,
    workerRows,
    enterpriseRows,
    weeklyTotals,
  }
}
