import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  FileText, BarChart3, TrendingUp, Package, DollarSign, ClipboardList, ChevronRight, RefreshCw, Users2,
} from 'lucide-react'
import { db } from '../../core/database/db'
import { useAuthStore } from '../../stores/auth-store'

type ReportCategory = 'enterprise' | 'financial' | 'operational'

interface ReportCard {
  id: string
  category: ReportCategory
  title: string
  description: string
  icon: React.ReactNode
  route: string
}

const ICONS: Record<string, React.ReactNode> = {
  batch_completion: <ClipboardList className='w-5 h-5 text-primary-600' />,
  cross_enterprise: <BarChart3 className='w-5 h-5 text-primary-600' />,
  farm_pnl: <DollarSign className='w-5 h-5 text-primary-600' />,
  cash_flow: <TrendingUp className='w-5 h-5 text-primary-600' />,
  inventory_status: <Package className='w-5 h-5 text-primary-600' />,
  mortality_analysis: <FileText className='w-5 h-5 text-primary-600' />,
  labor_cost: <Users2 className='w-5 h-5 text-primary-600' />,
}

const REPORT_CARDS: ReportCard[] = [
  {
    id: 'batch_completion',
    category: 'enterprise',
    title: 'Batch Completion',
    description: 'Full lifecycle KPIs and financial summary per batch',
    icon: ICONS['batch_completion'],
    route: '/reports/config/batch_completion',
  },
  {
    id: 'cross_enterprise',
    category: 'enterprise',
    title: 'Cross-Enterprise',
    description: 'Compare all enterprises by type, ranked by margin',
    icon: ICONS['cross_enterprise'],
    route: '/reports/config/cross_enterprise',
  },
  {
    id: 'farm_pnl',
    category: 'financial',
    title: 'Farm P&L',
    description: 'Income statement with enterprise breakdown',
    icon: ICONS['farm_pnl'],
    route: '/reports/config/farm_pnl',
  },
  {
    id: 'cash_flow',
    category: 'financial',
    title: 'Cash Flow',
    description: 'Weekly cash in/out with running totals',
    icon: ICONS['cash_flow'],
    route: '/reports/config/cash_flow',
  },
  {
    id: 'inventory_status',
    category: 'operational',
    title: 'Inventory Status',
    description: 'Stock levels, consumption rates, and value',
    icon: ICONS['inventory_status'],
    route: '/reports/config/inventory_status',
  },
  {
    id: 'mortality_analysis',
    category: 'operational',
    title: 'Mortality Analysis',
    description: 'Deaths and survival rates across enterprises',
    icon: ICONS['mortality_analysis'],
    route: '/reports/config/mortality_analysis',
  },
  {
    id: 'labor_cost',
    category: 'operational',
    title: 'Labor Cost',
    description: 'Permanent & casual labor breakdown by worker and enterprise',
    icon: ICONS['labor_cost'],
    route: '/reports/config/labor_cost',
  },
]

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  enterprise: 'ENTERPRISE',
  financial: 'FINANCIAL',
  operational: 'OPERATIONAL',
}

const CATEGORY_ORDER: ReportCategory[] = ['enterprise', 'financial', 'operational']

export default function ReportsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    const loadPending = async () => {
      const pending = await db.financialTransactions
        .where('syncStatus')
        .equals('pending')
        .count()
      setPendingCount(pending)
    }
    void loadPending()
  }, [userId])

  const grouped = CATEGORY_ORDER.reduce<Record<ReportCategory, ReportCard[]>>(
    (acc, cat) => {
      acc[cat] = REPORT_CARDS.filter((c) => c.category === cat)
      return acc
    },
    { enterprise: [], financial: [], operational: [] },
  )

  return (
    <div className='min-h-dvh bg-gray-50 flex flex-col'>
      <div className='bg-white border-b border-gray-200 px-4 py-3 safe-top'>
        <div className='flex items-center justify-between'>
          <h1 className='text-lg font-semibold text-gray-900'>Reports</h1>
          {pendingCount > 0 && (
            <span className='flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium'>
              <RefreshCw className='w-3 h-3' />
              {pendingCount} pending sync
            </span>
          )}
        </div>
      </div>

      <div className='flex-1 overflow-y-auto p-4 space-y-6'>
        {CATEGORY_ORDER.map((category) => {
          const cards = grouped[category]
          if (cards.length === 0) return null
          return (
            <div key={category}>
              <h2 className='text-xs font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1'>
                {CATEGORY_LABELS[category]}
              </h2>
              <div className='space-y-2'>
                {cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => navigate(card.route)}
                    className='w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 text-left active:bg-gray-50 transition-colors'
                  >
                    <div className='w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0'>
                      {card.icon}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='font-semibold text-gray-900 text-sm'>{card.title}</p>
                      <p className='text-xs text-gray-500 mt-0.5 leading-snug'>
                        {card.description}
                      </p>
                    </div>
                    <ChevronRight className='w-4 h-4 text-gray-400 flex-shrink-0' />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
