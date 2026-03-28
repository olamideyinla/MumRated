import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'
import type { FinancialTransaction, FinancialCategory } from '../../../shared/types'

export interface DateRange { from: string; to: string }

export interface MonthlyFinancials {
  income: number
  expenses: number
  net: number
  transactions: FinancialTransaction[]
}

// ── useMonthlyFinancials ──────────────────────────────────────────────────────

/** Summed income, expenses, and net for a given year/month (1-based) */
export function useMonthlyFinancials(
  year: number,
  month: number,
): MonthlyFinancials | undefined | null {
  const userId = useAuthStore(s => s.userId)

  // Compute date bounds outside the live query callback
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null

    const txns = await db.financialTransactions
      .where('organizationId').equals(user.organizationId)
      .filter(t => t.date >= from && t.date <= to)
      .toArray()

    const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    return { income, expenses, net: income - expenses, transactions: txns }
  }, [userId, year, month])
}

// ── useEnterpriseFinancials ───────────────────────────────────────────────────

/** All financial transactions for a specific enterprise, sorted newest first */
export function useEnterpriseFinancials(
  enterpriseId: string | undefined,
): FinancialTransaction[] | undefined {
  return useLiveQuery(async () => {
    if (!enterpriseId) return []
    const txns = await db.financialTransactions
      .where('enterpriseInstanceId').equals(enterpriseId).toArray()
    return txns.sort((a, b) => b.date.localeCompare(a.date))
  }, [enterpriseId])
}

// ── useExpensesByCategory ─────────────────────────────────────────────────────

/** Grouped expense totals within a date range, for the current user's org */
export function useExpensesByCategory(
  dateRange: DateRange,
): Partial<Record<FinancialCategory, number>> | undefined {
  const userId = useAuthStore(s => s.userId)

  return useLiveQuery(async () => {
    if (!userId) return {}
    const user = await db.appUsers.get(userId)
    if (!user) return {}

    const txns = await db.financialTransactions
      .where('organizationId').equals(user.organizationId)
      .filter(t =>
        t.type === 'expense' &&
        t.date >= dateRange.from &&
        t.date <= dateRange.to,
      )
      .toArray()

    const totals: Partial<Record<FinancialCategory, number>> = {}
    for (const txn of txns) {
      totals[txn.category] = (totals[txn.category] ?? 0) + txn.amount
    }
    return totals
  }, [userId, dateRange.from, dateRange.to])
}
