import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, subMonths,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
} from 'date-fns'
import { db } from '../../core/database/db'
import { useAuthStore } from '../../stores/auth-store'
import { generateBatchCompletionReport } from '../../core/services/report-generators/batch-completion'
import { generateCrossEnterpriseReport } from '../../core/services/report-generators/cross-enterprise'
import { generateFarmPnlReport } from '../../core/services/report-generators/farm-pnl'
import { generateCashFlowReport } from '../../core/services/report-generators/cash-flow'
import { generateInventoryStatusReport } from '../../core/services/report-generators/inventory-status'
import { generateLaborCostReport } from '../../core/services/report-generators/labor-cost'
import type { EnterpriseInstance } from '../../shared/types'

type DatePreset = 'this_month' | 'last_month' | 'quarter' | 'year' | 'custom'

const ENTERPRISE_REPORT_TYPES = new Set(['batch_completion', 'cross_enterprise'])

const REPORT_TITLES: Record<string, string> = {
  batch_completion: 'Batch Completion',
  cross_enterprise: 'Cross-Enterprise',
  farm_pnl: 'Farm P&L',
  cash_flow: 'Cash Flow',
  inventory_status: 'Inventory Status',
  mortality_analysis: 'Mortality Analysis',
  labor_cost: 'Labor Cost',
}

function dateRangeForPreset(preset: Exclude<DatePreset, 'custom'>): { from: Date; to: Date } {
  const now = new Date()
  switch (preset) {
    case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_month': {
      const lm = subMonths(now, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm) }
    }
    case 'quarter': return { from: startOfQuarter(now), to: endOfQuarter(now) }
    case 'year': return { from: startOfYear(now), to: endOfYear(now) }
  }
}
export default function ReportConfigPage() {
  const { reportType } = useParams<{ reportType: string }>()
  const navigate = useNavigate()
  const appUser = useAuthStore((s) => s.appUser)
  const orgId = appUser?.organizationId ?? null

  const [preset, setPreset] = useState<DatePreset>('this_month')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enterprises, setEnterprises] = useState<EnterpriseInstance[]>([])
  const [farmName, setFarmName] = useState('My Farm')

  useEffect(() => {
    if (!orgId) return
    const init = async () => {
      const org = await db.organizations.where('id').equals(orgId).first()
      if (org) setFarmName(org.name)
      if (ENTERPRISE_REPORT_TYPES.has(reportType ?? '')) {
        const locs = await db.farmLocations.where('organizationId').equals(orgId).toArray()
        const locIds = new Set(locs.map((l) => l.id))
        const infras = await db.infrastructures.toArray()
        const orgInfraIds = new Set(infras.filter((i) => locIds.has(i.farmLocationId)).map((i) => i.id))
        const insts = await db.enterpriseInstances.toArray()
        setEnterprises(insts.filter((e) => orgInfraIds.has(e.infrastructureId)))
      }
    }
    void init()
  }, [orgId, reportType])

  const getDateRange = (): { from: string; to: string } => {
    if (preset === 'custom') return { from: customFrom, to: customTo }
    const { from, to } = dateRangeForPreset(preset)
    return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') }
  }

  const handleGenerate = async () => {
    if (!orgId) { setError('Organization not found'); return }
    setLoading(true)
    setError(null)
    try {
      const dateRange = getDateRange()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let reportData: any
      switch (reportType) {
        case 'batch_completion':
          reportData = await generateBatchCompletionReport(orgId, dateRange, farmName)
          break
        case 'cross_enterprise':
          reportData = await generateCrossEnterpriseReport(orgId, dateRange, farmName)
          break
        case 'farm_pnl':
          reportData = await generateFarmPnlReport(orgId, dateRange, farmName)
          break
        case 'cash_flow':
          reportData = await generateCashFlowReport(orgId, dateRange, farmName)
          break
        case 'inventory_status':
          reportData = await generateInventoryStatusReport(orgId, farmName)
          break
        case 'labor_cost':
          reportData = await generateLaborCostReport(orgId, dateRange, farmName)
          break
        default:
          throw new Error('Unknown report type: ' + reportType)
      }
      sessionStorage.setItem('currentReport', JSON.stringify(reportData))
      sessionStorage.setItem('currentReportType', reportType ?? '')
      sessionStorage.setItem('currentReportTitle', REPORT_TITLES[reportType ?? ''] ?? 'Report')
      navigate('/reports/view')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const PRESETS: { id: DatePreset; label: string }[] = [
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'year', label: 'Year' },
    { id: 'custom', label: 'Custom' },
  ]

  const title = REPORT_TITLES[reportType ?? ''] ?? 'Report'
  const isEnterpriseReport = ENTERPRISE_REPORT_TYPES.has(reportType ?? '')

  return (
    <div className='min-h-dvh bg-gray-50 flex flex-col'>
      {/* Header */}
      <div className='bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 safe-top'>
        <button
          onClick={() => navigate(-1)}
          className='p-1 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100'
        >
          <ArrowLeft className='w-5 h-5' />
        </button>
        <h1 className='text-base font-semibold text-gray-900'>{title}</h1>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4 space-y-6'>
        {/* Date Range Card */}
        <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
          <div className='flex items-center gap-2 mb-3'>
            <Calendar className='w-4 h-4 text-gray-500' />
            <h2 className='text-sm font-semibold text-gray-700'>Date Range</h2>
          </div>
          <div className='flex flex-wrap gap-2'>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  preset === p.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className='mt-4 grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs text-gray-500 mb-1'>From</label>
                <input
                  type='date'
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                />
              </div>
              <div>
                <label className='block text-xs text-gray-500 mb-1'>To</label>
                <input
                  type='date'
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                />
              </div>
            </div>
          )}
        </div>

        {/* Enterprise info -- only for batch/cross reports */}
        {isEnterpriseReport && enterprises.length > 0 && (
          <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
            <h2 className='text-sm font-semibold text-gray-700 mb-2'>Enterprises</h2>
            <p className='text-xs text-gray-500 mb-2'>All {enterprises.length} enterprises included.</p>
            <div className='space-y-1'>
              {enterprises.slice(0, 5).map((e) => (
                <div key={e.id} className='text-xs text-gray-600 flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 rounded-full bg-primary-400 inline-block' />
                  <span>{e.name}</span>
                  <span className='text-gray-400'>({e.enterpriseType})</span>
                </div>
              ))}
              {enterprises.length > 5 && (
                <p className='text-xs text-gray-400'>+ {enterprises.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className='bg-red-50 border border-red-200 rounded-xl px-4 py-3'>
            <p className='text-sm text-red-700'>{error}</p>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={() => void handleGenerate()}
          disabled={loading}
          className='w-full bg-primary-600 text-white py-3 px-4 rounded-2xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary-700 active:bg-primary-800 transition-colors'
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>
    </div>
  )
}
