import { db } from '../../database/db'
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  isWithinInterval,
} from 'date-fns'

export interface WeeklyCashFlow {
  weekLabel: string
  weekStart: string
  weekEnd: string
  cashIn: number
  cashOut: number
  net: number
  runningBalance: number
}

export interface CashFlowReport {
  generatedAt: string
  farmName: string
  dateRange: { from: string; to: string }
  weeks: WeeklyCashFlow[]
  totalCashIn: number
  totalCashOut: number
  netCashFlow: number
  openingBalance: number
  closingBalance: number
}

export async function generateCashFlowReport(
  orgId: string,
  dateRange: { from: string; to: string },
  farmName: string,
): Promise<CashFlowReport> {
  const allTransactions = await db.financialTransactions
    .where('organizationId')
    .equals(orgId)
    .toArray()

  const rangeTransactions = allTransactions.filter(
    (t) => t.date >= dateRange.from && t.date <= dateRange.to,
  )

  // Build weekly buckets
  const fromDate = parseISO(dateRange.from)
  const toDate = parseISO(dateRange.to)

  // Align to Monday-based weeks
  let weekStart = startOfWeek(fromDate, { weekStartsOn: 1 })
  const weeks: WeeklyCashFlow[] = []
  let runningBalance = 0

  while (weekStart <= toDate) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    // Clamp display to requested range
    const displayStart = weekStartStr < dateRange.from ? dateRange.from : weekStartStr
    const displayEnd = weekEndStr > dateRange.to ? dateRange.to : weekEndStr

    const weekLabel = `${format(parseISO(displayStart), 'MMM d')}-${format(parseISO(displayEnd), 'd')}`

    // Collect transactions for this week
    const weekTxns = rangeTransactions.filter((t) => {
      return t.date >= weekStartStr && t.date <= weekEndStr
    })

    const cashIn = weekTxns
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const cashOut = weekTxns
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    const net = cashIn - cashOut
    runningBalance += net

    weeks.push({
      weekLabel,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      cashIn,
      cashOut,
      net,
      runningBalance,
    })

    weekStart = addWeeks(weekStart, 1)
  }

  const totalCashIn = weeks.reduce((s, w) => s + w.cashIn, 0)
  const totalCashOut = weeks.reduce((s, w) => s + w.cashOut, 0)
  const netCashFlow = totalCashIn - totalCashOut

  return {
    generatedAt: new Date().toISOString(),
    farmName,
    dateRange,
    weeks,
    totalCashIn,
    totalCashOut,
    netCashFlow,
    openingBalance: 0,
    closingBalance: netCashFlow,
  }
}
