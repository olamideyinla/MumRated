import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO, subMonths } from 'date-fns'
import { Plus, ExternalLink, ArrowLeft } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useMonthlyFinancials, useExpensesByCategory } from '../../core/database/hooks/use-financials'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import { useCurrency } from '../../shared/hooks/useCurrency'
import type { FinancialCategory, FinancialTransaction } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<FinancialCategory, string> = {
  feed:           'Feed',
  labor:          'Labor',
  medication:     'Medication',
  transport:      'Transport',
  utilities:      'Utilities',
  sales_eggs:     'Egg Sales',
  sales_birds:    'Bird Sales',
  sales_milk:     'Milk Sales',
  sales_fish:     'Fish Sales',
  sales_crops:    'Crop Sales',
  sales_other:    'Other Sales',
  rent:           'Rent',
  insurance:      'Insurance',
  equipment:      'Equipment',
  administrative: 'Admin',
  other:          'Other',
}

const PIE_COLORS = [
  '#2D6A4F', '#52b788', '#DAA520', '#f97316', '#8B6914',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ef4444',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByWeek(txns: FinancialTransaction[]): Map<string, FinancialTransaction[]> {
  const map = new Map<string, FinancialTransaction[]>()
  for (const t of txns) {
    const key = format(parseISO(t.date), "'Week of' d MMM")
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return map
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, amount, color, loading,
}: {
  label: string; amount: number; color: 'emerald' | 'red'; loading?: boolean
}) {
  const { fmt } = useCurrency()
  const textColor = color === 'emerald' ? 'text-emerald-600' : 'text-red-500'
  const bgColor   = color === 'emerald' ? 'bg-emerald-50'   : 'bg-red-50'
  return (
    <div className={`${bgColor} rounded-2xl p-3 flex-1 min-w-0`}>
      <p className="text-xs text-gray-500 truncate">{label}</p>
      {loading
        ? <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mt-1" />
        : <p className={`text-base font-bold ${textColor} truncate`}>{fmt(amount)}</p>
      }
    </div>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({
  txn, enterpriseNames,
}: {
  txn: FinancialTransaction; enterpriseNames: Map<string, string>
}) {
  const { fmt } = useCurrency()
  const isIncome = txn.type === 'income'
  const entName  = txn.enterpriseInstanceId ? enterpriseNames.get(txn.enterpriseInstanceId) : undefined
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-800">
            {CATEGORY_LABEL[txn.category] ?? txn.category}
          </span>
          {entName && (
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 truncate max-w-[110px]">
              {entName}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {format(parseISO(txn.date), 'd MMM yyyy')}
          {txn.notes ? ` · ${txn.notes}` : ''}
        </p>
      </div>
      <p className={`text-sm font-semibold shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
        {isIncome ? '+' : '-'}{fmt(txn.amount)}
      </p>
    </div>
  )
}

// ── Grouped transaction list ──────────────────────────────────────────────────

function TxList({
  transactions, enterpriseNames, emptyIcon, emptyText,
}: {
  transactions: FinancialTransaction[]
  enterpriseNames: Map<string, string>
  emptyIcon: string
  emptyText: string
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const sorted  = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date)), [transactions])
  const grouped = useMemo(() => groupByWeek(sorted), [sorted])

  // Flatten into renderable rows: week headers + transaction rows
  type Row =
    | { kind: 'header'; week: string }
    | { kind: 'txn'; txn: FinancialTransaction }

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = []
    for (const [week, txns] of grouped.entries()) {
      result.push({ kind: 'header', week })
      for (const t of txns) result.push({ kind: 'txn', txn: t })
    }
    return result
  }, [grouped])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => rows[i]?.kind === 'header' ? 36 : 56,
    overscan: 5,
  })

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center py-10 mt-4">
        <p className="text-3xl mb-2">{emptyIcon}</p>
        <p className="text-sm text-gray-500">{emptyText}</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="mt-3 overflow-y-auto" style={{ maxHeight: '65vh' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vItem => {
          const row = rows[vItem.index]
          return (
            <div
              key={vItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vItem.start}px)`,
              }}
            >
              {row.kind === 'header' ? (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-3 pb-1">
                  {row.week}
                </p>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 mb-1">
                  <TxRow txn={row.txn} enterpriseNames={enterpriseNames} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const userId = useAuthStore(s => s.user?.id)
  const now    = new Date()

  // Six-month income/expense chart — one query, JS grouping
  const sixMonthData = useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, 'MMM') }
    })

    const earliest = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`
    const latest   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`

    const allTxns = await db.financialTransactions
      .where('organizationId').equals(user.organizationId)
      .filter(t => t.date >= earliest && t.date <= latest)
      .toArray()

    return months.map(({ month, year, label }) => {
      const from    = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to      = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const slice   = allTxns.filter(t => t.date >= from && t.date <= to)
      const income   = slice.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expenses = slice.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { label, income, expenses }
    })
  }, [userId]) ?? []

  // Expense by category — current month
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1
  const expFrom  = `${curYear}-${String(curMonth).padStart(2, '0')}-01`
  const expLastD = new Date(curYear, curMonth, 0).getDate()
  const expTo    = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(expLastD).padStart(2, '0')}`
  const expensesByCategory = useExpensesByCategory({ from: expFrom, to: expTo })

  const pieData = useMemo(() => {
    if (!expensesByCategory) return []
    return Object.entries(expensesByCategory)
      .filter(([, v]) => v != null && v > 0)
      .map(([cat, val], i) => ({
        name:  CATEGORY_LABEL[cat as FinancialCategory] ?? cat,
        value: Math.round((val ?? 0) * 100) / 100,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
  }, [expensesByCategory])

  // Enterprise profitability (all-time)
  const entProfit = useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []

    const enterprises = await db.enterpriseInstances
      .where('status').equals('active').toArray()

    const allTxns = await db.financialTransactions
      .where('organizationId').equals(user.organizationId).toArray()

    return enterprises.map(ent => {
      const et    = allTxns.filter(t => t.enterpriseInstanceId === ent.id)
      const inc   = et.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const exp   = et.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { id: ent.id, name: ent.name, net: inc - exp, income: inc, expenses: exp }
    })
  }, [userId]) ?? []

  const chartEmpty = sixMonthData.every(d => d.income === 0 && d.expenses === 0)

  return (
    <div className="space-y-4 pb-6">
      {/* 6-month bar chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Income vs Expenses (6 months)</h3>
        {chartEmpty ? (
          <div className="h-40 flex items-center justify-center text-xs text-gray-400">
            No transaction data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sixMonthData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} animationDuration={800}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(val: number) => [fmt(val), undefined]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="income"   name="Income"   fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 justify-center mt-2">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Income
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Expenses
          </span>
        </div>
      </div>

      {/* Expense breakdown pie */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Expense Breakdown — {format(now, 'MMMM yyyy')}
        </h3>
        {pieData.length === 0 ? (
          <div className="h-36 flex items-center justify-center text-xs text-gray-400">
            No expenses this month
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="value"
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                formatter={(val: number) => [fmt(val), undefined]}
                contentStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Enterprise profitability */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Enterprise Profitability</h3>
        {entProfit.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No active enterprises</p>
        ) : entProfit.map(ent => (
          <div key={ent.id} className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{ent.name}</p>
              <p className="text-xs text-gray-400">In {fmt(ent.income)} · Out {fmt(ent.expenses)}</p>
            </div>
            <p className={`text-sm font-bold shrink-0 ${ent.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {ent.net >= 0 ? '+' : '-'}{fmt(Math.abs(ent.net))}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabId = 'income' | 'expenses' | 'overview'

export default function FinancialsPage() {
  const navigate = useNavigate()
  const now      = new Date()
  const monthly  = useMonthlyFinancials(now.getFullYear(), now.getMonth() + 1)
  const loading  = monthly === undefined
  const [tab, setTab] = useState<TabId>('income')
  const { fmt }  = useCurrency()

  const enterpriseNames = useLiveQuery(async () => {
    const all = await db.enterpriseInstances.toArray()
    const map = new Map<string, string>()
    for (const e of all) map.set(e.id, e.name)
    return map
  }, []) ?? new Map<string, string>()

  const income   = monthly?.income   ?? 0
  const expenses = monthly?.expenses ?? 0
  const net      = monthly?.net      ?? 0
  const incTxns  = (monthly?.transactions ?? []).filter(t => t.type === 'income')
  const expTxns  = (monthly?.transactions ?? []).filter(t => t.type === 'expense')

  const TABS: { id: TabId; label: string }[] = [
    { id: 'income',   label: 'Income'   },
    { id: 'expenses', label: 'Expenses' },
    { id: 'overview', label: 'Overview' },
  ]

  return (
    <div className="min-h-dvh bg-gray-50 pb-28 fade-in">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center text-gray-500 active:scale-95 transition-transform -ml-1">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Financials</h1>
              <p className="text-xs text-gray-500">{format(now, 'MMMM yyyy')}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/financials/ar')}
            className="flex items-center gap-1 text-xs text-primary-600 font-medium border border-primary-200 rounded-lg px-2.5 py-1.5 active:scale-95 transition-transform"
          >
            <ExternalLink size={13} /> View AR
          </button>
        </div>

        {/* Summary cards */}
        <div className="flex gap-2 mb-3">
          <SummaryCard label="Income"   amount={income}   color="emerald" loading={loading} />
          <SummaryCard label="Expenses" amount={expenses} color="red"     loading={loading} />
          <SummaryCard label="Net" amount={Math.abs(net)} color={net >= 0 ? 'emerald' : 'red'} loading={loading} />
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 -mb-px">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-sm py-2.5 font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        {tab === 'income'   && <TxList transactions={incTxns} enterpriseNames={enterpriseNames} emptyIcon="📥" emptyText="No income this month" />}
        {tab === 'expenses' && <TxList transactions={expTxns} enterpriseNames={enterpriseNames} emptyIcon="📤" emptyText="No expenses this month" />}
        {tab === 'overview' && <OverviewTab />}
      </div>

      {/* FABs */}
      {tab === 'income' && (
        <button
          onClick={() => navigate('/financials/sale')}
          className="fixed bottom-24 right-4 bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-20"
          aria-label="Record Sale"
        >
          <Plus size={26} />
        </button>
      )}
      {tab === 'expenses' && (
        <button
          onClick={() => navigate('/financials/expense')}
          className="fixed bottom-24 right-4 bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-20"
          aria-label="Record Expense"
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  )
}
