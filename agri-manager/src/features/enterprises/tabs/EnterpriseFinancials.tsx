import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useEnterpriseFinancials } from '../../../core/database/hooks/use-financials'
import { CostBreakdownPie } from '../../../shared/components/charts/CostBreakdownPie'
import { netProfit, profitMarginPct } from '../../../core/services/kpi-calculator'
import { createBatchReport } from '../../../core/services/pdf-export'
import { shareFile } from '../../../shared/utils/file-download'
import { db } from '../../../core/database/db'
import { useCurrency } from '../../../shared/hooks/useCurrency'
import type { EnterpriseInstance, FinancialCategory, FinancialTransaction } from '../../../shared/types'
import type { AnyDailyRecord } from '../../../core/database/hooks/use-daily-records'

// ── Colour map for categories ──────────────────────────────────────────────────

const CATEGORY_COLORS: Partial<Record<FinancialCategory, string>> = {
  feed:          '#2D6A4F',
  labor:         '#52b788',
  medication:    '#DAA520',
  transport:     '#f97316',
  utilities:     '#3b82f6',
  sales_eggs:    '#22c55e',
  sales_birds:   '#16a34a',
  sales_milk:    '#6366f1',
  sales_fish:    '#0ea5e9',
  sales_crops:   '#84cc16',
  sales_other:   '#a3e635',
  equipment:     '#8b5cf6',
  rent:          '#ec4899',
  other:         '#9ca3af',
}

function categoryLabel(cat: FinancialCategory): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryRow({ label, value, color, fmt }: { label: string; value: number; color: string; fmt: (n: number) => string }) {
  return (
    <div className="text-center flex-1">
      <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { enterprise: EnterpriseInstance }

export function EnterpriseFinancials({ enterprise }: Props) {
  const navigate = useNavigate()
  const transactions = useEnterpriseFinancials(enterprise.id)
  const [isExporting, setIsExporting] = useState(false)
  const { fmt, currency } = useCurrency()

  const handleExportPdf = async () => {
    if (!transactions) return
    setIsExporting(true)
    try {
      const eid = enterprise.id
      const byCompound = (table: any): Promise<AnyDailyRecord[]> =>
        table.where('[enterpriseInstanceId+date]')
          .between([eid, '0000-00-00'], [eid, '9999-99-99'], true, true)
          .toArray()

      let records: AnyDailyRecord[] = []
      switch (enterprise.enterpriseType) {
        case 'layers':          records = await byCompound(db.layerDailyRecords); break
        case 'broilers':        records = await byCompound(db.broilerDailyRecords); break
        case 'cattle_dairy':
        case 'cattle_beef':     records = await byCompound(db.cattleDailyRecords); break
        case 'fish':            records = await byCompound(db.fishDailyRecords); break
        case 'pigs_breeding':
        case 'pigs_growfinish': records = await byCompound(db.pigDailyRecords); break
        case 'rabbit':          records = await byCompound(db.rabbitDailyRecords); break
        case 'custom_animal':   records = await byCompound(db.customAnimalDailyRecords); break
        case 'crop_annual':
        case 'crop_perennial':  records = await db.cropActivityRecords.where('enterpriseInstanceId').equals(eid).toArray(); break
      }

      const orgs = await db.organizations.toArray()
      const farmName = orgs[0]?.name ?? 'Farm'
      const blob = createBatchReport({ enterprise, records, financials: transactions, farmName, currency })
      const today = format(new Date(), 'yyyy-MM-dd')
      await shareFile(blob, `batch-${enterprise.name.replace(/ /g, '-')}-${today}.pdf`, enterprise.name)
    } finally {
      setIsExporting(false)
    }
  }

  if (transactions === undefined) {
    return <div className="p-4 text-sm text-gray-400">Loading…</div>
  }

  const income   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = netProfit(income, expenses)
  const margin = profitMarginPct(income, expenses)

  // Group expenses by category for pie chart
  const expenseByCategory = new Map<FinancialCategory, number>()
  for (const t of transactions.filter(t => t.type === 'expense')) {
    expenseByCategory.set(t.category, (expenseByCategory.get(t.category) ?? 0) + t.amount)
  }
  const pieData = Array.from(expenseByCategory.entries()).map(([cat, val]) => ({
    name: categoryLabel(cat),
    value: Math.round(val * 100) / 100,
    color: CATEGORY_COLORS[cat] ?? '#9ca3af',
  }))

  // Per-unit economics
  const entType = enterprise.enterpriseType
  const stockCount = enterprise.currentStockCount || enterprise.initialStockCount || 1

  if (transactions.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-4xl mb-2">💰</p>
        <p className="text-sm text-gray-500 font-medium">No financial records yet</p>
        <p className="text-xs text-gray-400 mt-1">Link sales and expenses to this enterprise in Financials</p>
        <button
          onClick={() => navigate('/financials')}
          className="mt-4 btn-primary text-sm"
        >
          Go to Financials
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Gross margin summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Gross Margin</p>
        <div className="flex items-stretch divide-x divide-gray-100">
          <SummaryRow label="Revenue" value={income} color="text-emerald-600" fmt={fmt} />
          <SummaryRow label="Costs" value={expenses} color="text-red-500" fmt={fmt} />
          <SummaryRow label="Net" value={net} color={net >= 0 ? 'text-emerald-600' : 'text-red-500'} fmt={fmt} />
        </div>
        <div className={`mt-3 py-1.5 px-3 rounded-xl text-center text-sm font-semibold ${
          margin >= 20 ? 'bg-emerald-50 text-emerald-700' :
          margin >= 0  ? 'bg-amber-50 text-amber-700'    : 'bg-red-50 text-red-700'
        }`}>
          Gross Margin: {margin}%
        </div>
      </div>

      {/* Cost breakdown */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Cost Breakdown</p>
          <CostBreakdownPie data={pieData} height={200} />
        </div>
      )}

      {/* Per-unit economics */}
      {expenses > 0 && (entType === 'layers' || entType === 'cattle_dairy' || entType === 'broilers' || entType === 'fish') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Per-Unit Economics</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Cost per animal</span>
              <span className="font-semibold">{fmt(expenses / stockCount)}</span>
            </div>
            {income > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Revenue per animal</span>
                <span className="font-semibold text-emerald-600">{fmt(income / stockCount)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Transactions</p>
          <button
            onClick={() => navigate('/financials')}
            className="text-xs text-primary-600 font-medium"
          >
            View all →
          </button>
        </div>
        {transactions.slice(0, 8).map(t => (
          <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{categoryLabel(t.category)}</p>
              <p className="text-xs text-gray-400">{t.date}</p>
            </div>
            <p className={`text-sm font-bold flex-shrink-0 ml-2 ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
              {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
            </p>
          </div>
        ))}
      </div>

      {/* Export actions */}
      <button
        onClick={handleExportPdf}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 text-white font-semibold text-sm disabled:opacity-60 active:bg-primary-700 transition-colors"
      >
        {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        {isExporting ? 'Generating PDF…' : 'Export PDF'}
      </button>
      <button
        onClick={() => navigate('/reports')}
        className="w-full flex items-center justify-center gap-2 py-1 text-primary-600 font-medium text-sm"
      >
        <FileText size={15} />
        Full Reports →
      </button>
    </div>
  )
}
