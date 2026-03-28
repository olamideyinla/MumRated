import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Share2 } from 'lucide-react'
import { shareFile } from '../../shared/utils/file-download'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import { format } from 'date-fns'
import { useCurrency } from '../../shared/hooks/useCurrency'
import { formatCurrency } from '../../core/utils/number'
import type { BatchCompletionReport } from '../../core/services/report-generators/batch-completion'
import type { CrossEnterpriseReport } from '../../core/services/report-generators/cross-enterprise'
import type { FarmPnlReport } from '../../core/services/report-generators/farm-pnl'
import type { CashFlowReport } from '../../core/services/report-generators/cash-flow'
import type { InventoryStatusReport } from '../../core/services/report-generators/inventory-status'
import type { LaborCostReport } from '../../core/services/report-generators/labor-cost'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReport = any

const STATUS_COLORS: Record<string, string> = {
  adequate: 'bg-green-100 text-green-700',
  low: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  out: 'bg-red-200 text-red-800',
}

/** Plain number formatter — for non-monetary values (counts, weights, %) */
function num(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pct(n: number): string { return n.toFixed(1) + '%' }

// ---- PDF Export ----
function exportPdf(reportData: AnyReport, reportType: string, title: string, currency = 'USD') {
  const fmtAmt = (n: number) => formatCurrency(n, currency)
  const doc = new jsPDF()
  const today = format(new Date(), 'yyyy-MM-dd')
  doc.setFontSize(18)
  doc.text(reportData.farmName ?? 'Farm Report', 14, 22)
  doc.setFontSize(12)
  doc.text(title, 14, 32)
  doc.setFontSize(9)
  const dr = reportData.dateRange
  if (dr) doc.text(`Date range: ${dr.from} to ${dr.to}`, 14, 40)
  doc.text(`Generated: ${today}`, 14, 47)

  let startY = 55

  if (reportType === 'batch_completion') {
    const r = reportData as BatchCompletionReport
    autoTable(doc, {
      startY,
      head: [['Enterprise', 'Type', 'Duration', 'Mortality%', 'Feed kg', 'Revenue', 'Costs', 'Net', 'Margin%']],
      body: r.batches.map((b) => [
        b.enterpriseName, b.enterpriseType, b.durationDays + 'd',
        pct(b.mortalityPct), num(b.totalFeedKg, 1), fmtAmt(b.totalRevenue),
        fmtAmt(b.totalCosts), fmtAmt(b.netProfit), pct(b.profitMarginPct),
      ]),
    })
  } else if (reportType === 'cross_enterprise') {
    const r = reportData as CrossEnterpriseReport
    autoTable(doc, {
      startY,
      head: [['Rank', 'Enterprise', 'Type', 'Revenue', 'Costs', 'Net', 'Margin%', 'Days']],
      body: r.rankings.map((e) => [
        e.rank, e.name, e.enterpriseType, fmtAmt(e.totalRevenue),
        fmtAmt(e.totalCosts), fmtAmt(e.netProfit), pct(e.grossMarginPct), e.daysActive,
      ]),
    })
  } else if (reportType === 'farm_pnl') {
    const r = reportData as FarmPnlReport
    autoTable(doc, {
      startY,
      head: [['Item', 'Amount']],
      body: r.lineItems.map((li) => [
        li.label,
        li.label.includes('%') ? num(li.amount, 1) : fmtAmt(li.amount),
      ]),
      columnStyles: { 1: { halign: 'right' } },
    })
  } else if (reportType === 'cash_flow') {
    const r = reportData as CashFlowReport
    autoTable(doc, {
      startY,
      head: [['Week', 'Cash In', 'Cash Out', 'Net', 'Running Balance']],
      body: r.weeks.map((w) => [
        w.weekLabel, fmtAmt(w.cashIn), fmtAmt(w.cashOut), fmtAmt(w.net), fmtAmt(w.runningBalance),
      ]),
    })
  } else if (reportType === 'inventory_status') {
    const r = reportData as InventoryStatusReport
    autoTable(doc, {
      startY,
      head: [['Item', 'Category', 'Stock', 'Unit', 'Reorder At', 'Daily Use', 'Days Left', 'Status']],
      body: r.items.map((i) => [
        i.name, i.category, num(i.currentStock, 1), i.unit,
        i.reorderPoint ?? '-', num(i.avgDailyConsumption, 2),
        i.daysRemaining > 0 ? num(i.daysRemaining, 1) : '-', i.status,
      ]),
    })
  } else if (reportType === 'labor_cost') {
    const r = reportData as LaborCostReport
    autoTable(doc, {
      startY,
      head: [['Worker', 'Days', 'Base Pay', 'OT Pay', 'Deductions', 'Net Pay']],
      body: r.workerRows.map((w) => [
        w.name, w.daysWorked, fmtAmt(w.basePay), fmtAmt(w.overtimePay),
        fmtAmt(w.deductions), fmtAmt(w.netPay),
      ]),
    })
    const afterWorkers = (doc as any).lastAutoTable?.finalY ?? startY + 20
    autoTable(doc, {
      startY: afterWorkers + 8,
      head: [['Enterprise', 'Permanent', 'Casual', 'Total']],
      body: r.enterpriseRows.map((e) => [
        e.name, fmtAmt(e.permanentCost), fmtAmt(e.casualCost), fmtAmt(e.totalCost),
      ]),
    })
  }
  doc.save(`${title.replace(/ /g, '-')}-${today}.pdf`)
}

// ---- CSV Export ----
function exportCsv(reportData: AnyReport, reportType: string, title: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = []
  if (reportType === 'batch_completion') {
    rows = (reportData as BatchCompletionReport).batches
  } else if (reportType === 'cross_enterprise') {
    rows = (reportData as CrossEnterpriseReport).rankings
  } else if (reportType === 'farm_pnl') {
    rows = (reportData as FarmPnlReport).lineItems
  } else if (reportType === 'cash_flow') {
    rows = (reportData as CashFlowReport).weeks
  } else if (reportType === 'inventory_status') {
    rows = (reportData as InventoryStatusReport).items
  } else if (reportType === 'labor_cost') {
    rows = (reportData as LaborCostReport).workerRows
  }
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${title.replace(/ /g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// ---- Report-specific table renderers ----

function BatchTable({ r }: { r: BatchCompletionReport }) {
  const { currency } = useCurrency()
  const fmtC = (n: number) => formatCurrency(n, currency ?? 'USD')
  if (r.batches.length === 0) return <p className='text-sm text-gray-500'>No batch data.</p>
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs border-collapse'>
        <thead>
          <tr className='bg-gray-50'>
            {['Enterprise','Type','Duration','Initial','Final','Mortality%','Feed kg','Revenue','Costs','Net','Margin%'].map((h) => (
              <th key={h} className='px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200'>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.batches.map((b) => (
            <tr key={b.enterpriseId} className='border-b border-gray-100 hover:bg-gray-50'>
              <td className='px-2 py-1.5 font-medium'>{b.enterpriseName}</td>
              <td className='px-2 py-1.5'>{b.enterpriseType}</td>
              <td className='px-2 py-1.5'>{b.durationDays}d</td>
              <td className='px-2 py-1.5'>{b.initialStock.toLocaleString()}</td>
              <td className='px-2 py-1.5'>{b.finalStock.toLocaleString()}</td>
              <td className='px-2 py-1.5'>{pct(b.mortalityPct)}</td>
              <td className='px-2 py-1.5'>{num(b.totalFeedKg, 1)}</td>
              <td className='px-2 py-1.5'>{fmtC(b.totalRevenue)}</td>
              <td className='px-2 py-1.5'>{fmtC(b.totalCosts)}</td>
              <td className={'px-2 py-1.5 font-semibold ' + (b.netProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                {fmtC(b.netProfit)}
              </td>
              <td className='px-2 py-1.5'>{pct(b.profitMarginPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CrossTable({ r }: { r: CrossEnterpriseReport }) {
  const { currency } = useCurrency()
  const fmtC = (n: number) => formatCurrency(n, currency ?? 'USD')
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs border-collapse'>
        <thead>
          <tr className='bg-gray-50'>
            {['Rank','Enterprise','Type','Revenue','Costs','Net Profit','Margin%','Days Active'].map((h) => (
              <th key={h} className='px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200'>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rankings.map((e) => (
            <tr key={e.enterpriseId} className='border-b border-gray-100 hover:bg-gray-50'>
              <td className='px-2 py-1.5 font-bold text-primary-600'>#{e.rank}</td>
              <td className='px-2 py-1.5 font-medium'>{e.name}</td>
              <td className='px-2 py-1.5'>{e.enterpriseType}</td>
              <td className='px-2 py-1.5'>{fmtC(e.totalRevenue)}</td>
              <td className='px-2 py-1.5'>{fmtC(e.totalCosts)}</td>
              <td className={'px-2 py-1.5 font-semibold ' + (e.netProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                {fmtC(e.netProfit)}
              </td>
              <td className='px-2 py-1.5'>{pct(e.grossMarginPct)}</td>
              <td className='px-2 py-1.5'>{e.daysActive}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PnlTable({ r }: { r: FarmPnlReport }) {
  const { currency } = useCurrency()
  const fmtC = (n: number) => formatCurrency(n, currency ?? 'USD')
  return (
    <div className='space-y-1'>
      {r.lineItems.map((li, i) => (
        <div
          key={i}
          className={[
            'flex justify-between py-1.5 px-2 text-sm',
            li.isSubtotal ? 'border-t border-gray-200 font-semibold' : '',
            li.isBold ? 'font-bold' : '',
          ].join(' ')}
        >
          <span className={li.indent ? 'text-gray-600' : 'text-gray-800'}>{li.label}</span>
          <span className={li.amount < 0 ? 'text-red-600' : 'text-gray-900'}>
            {li.amount !== 0
              ? li.label.includes('%') ? num(li.amount, 1) : fmtC(li.amount)
              : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function CashFlowTable({ r }: { r: CashFlowReport }) {
  const { currency } = useCurrency()
  const fmtC = (n: number) => formatCurrency(n, currency ?? 'USD')
  return (
    <div className='space-y-2'>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs border-collapse'>
          <thead>
            <tr className='bg-gray-50'>
              {['Week','Cash In','Cash Out','Net','Running Balance'].map((h) => (
                <th key={h} className='px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 first:text-left'>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.weeks.map((w) => (
              <tr key={w.weekStart} className='border-b border-gray-100 hover:bg-gray-50'>
                <td className='px-2 py-1.5 font-medium'>{w.weekLabel}</td>
                <td className='px-2 py-1.5 text-right text-green-600'>{fmtC(w.cashIn)}</td>
                <td className='px-2 py-1.5 text-right text-red-600'>{fmtC(w.cashOut)}</td>
                <td className={['px-2 py-1.5 text-right font-semibold', w.net >= 0 ? 'text-green-600' : 'text-red-600'].join(' ')}>
                  {fmtC(w.net)}
                </td>
                <td className='px-2 py-1.5 text-right'>{fmtC(w.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='grid grid-cols-3 gap-3 pt-2'>
        <div className='bg-green-50 rounded-xl p-3 text-center'>
          <p className='text-xs text-green-600 mb-0.5'>Total In</p>
          <p className='font-bold text-green-700'>{fmtC(r.totalCashIn)}</p>
        </div>
        <div className='bg-red-50 rounded-xl border border-red-100 p-3 text-center'>
          <p className='text-xs text-red-600 mb-0.5'>Total Out</p>
          <p className='font-bold text-red-700'>{fmtC(r.totalCashOut)}</p>
        </div>
        <div className={['rounded-xl p-3 text-center', r.netCashFlow >= 0 ? 'bg-primary-50' : 'bg-gray-100'].join(' ')}>
          <p className='text-xs text-gray-600 mb-0.5'>Net</p>
          <p className={r.netCashFlow >= 0 ? 'font-bold text-primary-700' : 'font-bold text-red-700'}>
            {fmtC(r.netCashFlow)}
          </p>
        </div>
      </div>
    </div>
  )
}

function InventoryTable({ r }: { r: InventoryStatusReport }) {
  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-3 gap-2 text-center'>
        <div className='bg-white rounded-xl border border-gray-100 p-3'>
          <p className='text-xl font-bold text-gray-900'>{r.totalItems}</p>
          <p className='text-xs text-gray-500'>Total Items</p>
        </div>
        <div className='bg-amber-50 rounded-xl p-3'>
          <p className='text-xl font-bold text-amber-700'>{r.lowStockCount}</p>
          <p className='text-xs text-amber-600'>Low Stock</p>
        </div>
        <div className='bg-red-50 rounded-xl p-3'>
          <p className='text-xl font-bold text-red-700'>{r.outOfStockCount}</p>
          <p className='text-xs text-red-600'>Out of Stock</p>
        </div>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs border-collapse'>
          <thead>
            <tr className='bg-gray-50'>
              {['Name','Category','Stock','Unit','Reorder At','Daily Use','Days Left','Status'].map((h) => (
                <th key={h} className='px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200'>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.items.map((item) => (
              <tr key={item.itemId} className='border-b border-gray-100 hover:bg-gray-50'>
                <td className='px-2 py-1.5 font-medium'>{item.name}</td>
                <td className='px-2 py-1.5 text-gray-500'>{item.category}</td>
                <td className='px-2 py-1.5'>{num(item.currentStock, 1)}</td>
                <td className='px-2 py-1.5 text-gray-500'>{item.unit}</td>
                <td className='px-2 py-1.5'>{item.reorderPoint != null ? item.reorderPoint : '-'}</td>
                <td className='px-2 py-1.5'>{num(item.avgDailyConsumption, 2)}</td>
                <td className='px-2 py-1.5'>{item.daysRemaining > 0 ? num(item.daysRemaining, 1) + 'd' : '-'}</td>
                <td className='px-2 py-1.5'>
                  <span className={['px-1.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[item.status] ?? ''].join(' ')}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LaborTable({ r }: { r: LaborCostReport }) {
  const { currency } = useCurrency()
  const fmtC = (n: number) => formatCurrency(n, currency ?? 'USD')
  return (
    <div className='space-y-4'>
      {/* Summary row */}
      <div className='grid grid-cols-3 gap-2 text-center'>
        <div className='bg-blue-50 rounded-xl p-3'>
          <p className='text-xs text-blue-600 mb-0.5'>Permanent</p>
          <p className='font-bold text-blue-700'>{fmtC(r.permanentLaborCost)}</p>
        </div>
        <div className='bg-amber-50 rounded-xl p-3'>
          <p className='text-xs text-amber-600 mb-0.5'>Casual</p>
          <p className='font-bold text-amber-700'>{fmtC(r.casualLaborCost)}</p>
        </div>
        <div className='bg-primary-50 rounded-xl p-3'>
          <p className='text-xs text-primary-600 mb-0.5'>Total</p>
          <p className='font-bold text-primary-700'>{fmtC(r.totalLaborCost)}</p>
        </div>
      </div>
      {/* Worker rows */}
      {r.workerRows.length > 0 && (
        <div className='overflow-x-auto'>
          <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'>Workers</p>
          <table className='w-full text-xs border-collapse'>
            <thead>
              <tr className='bg-gray-50'>
                {['Worker','Days','Base Pay','OT Pay','Deductions','Net Pay'].map((h) => (
                  <th key={h} className='px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.workerRows.map((w) => (
                <tr key={w.name} className='border-b border-gray-100 hover:bg-gray-50'>
                  <td className='px-2 py-1.5 font-medium'>{w.name}</td>
                  <td className='px-2 py-1.5'>{w.daysWorked}</td>
                  <td className='px-2 py-1.5'>{fmtC(w.basePay)}</td>
                  <td className='px-2 py-1.5'>{fmtC(w.overtimePay)}</td>
                  <td className='px-2 py-1.5'>{fmtC(w.deductions)}</td>
                  <td className='px-2 py-1.5 font-semibold text-primary-700'>{fmtC(w.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Enterprise rows */}
      {r.enterpriseRows.length > 0 && (
        <div className='overflow-x-auto'>
          <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'>By Enterprise</p>
          <table className='w-full text-xs border-collapse'>
            <thead>
              <tr className='bg-gray-50'>
                {['Enterprise','Permanent','Casual','Total'].map((h) => (
                  <th key={h} className='px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.enterpriseRows.map((e) => (
                <tr key={e.name} className='border-b border-gray-100 hover:bg-gray-50'>
                  <td className='px-2 py-1.5 font-medium'>{e.name}</td>
                  <td className='px-2 py-1.5'>{fmtC(e.permanentCost)}</td>
                  <td className='px-2 py-1.5'>{fmtC(e.casualCost)}</td>
                  <td className='px-2 py-1.5 font-semibold'>{fmtC(e.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Main Page ----
export default function ReportViewPage() {
  const navigate = useNavigate()
  const [reportData, setReportData] = useState<AnyReport | null>(null)
  const [reportType, setReportType] = useState('')
  const [reportTitle, setReportTitle] = useState('Report')
  const { currency } = useCurrency()

  useEffect(() => {
    const raw = sessionStorage.getItem('currentReport')
    const type = sessionStorage.getItem('currentReportType') ?? ''
    const title = sessionStorage.getItem('currentReportTitle') ?? 'Report'
    if (raw) {
      try { setReportData(JSON.parse(raw)) } catch { /* ignore */ }
    }
    setReportType(type)
    setReportTitle(title)
  }, [])

  const handlePdf = () => {
    if (!reportData) return
    exportPdf(reportData, reportType, reportTitle, currency ?? 'USD')
  }

  const handleCsv = () => {
    if (!reportData) return
    exportCsv(reportData, reportType, reportTitle)
  }

  const handleShare = async () => {
    if (!reportData) return
    const doc = new jsPDF()
    const today = format(new Date(), 'yyyy-MM-dd')
    doc.setFontSize(18)
    doc.text(reportData.farmName ?? 'Farm Report', 14, 22)
    doc.setFontSize(12)
    doc.text(reportTitle, 14, 32)
    doc.setFontSize(9)
    const dr = reportData.dateRange
    if (dr) doc.text(`Date range: ${dr.from} to ${dr.to}`, 14, 40)
    doc.text(`Generated: ${today}`, 14, 47)
    const blob = doc.output('blob')
    const filename = `${reportTitle.replace(/ /g, '-')}-${today}.pdf`
    await shareFile(blob, filename, reportTitle)
  }

  const dr = reportData?.dateRange as { from: string; to: string } | undefined
  const dateRangeLabel = dr ? `${dr.from} to ${dr.to}` : ''

  return (
    <div className='min-h-dvh bg-gray-50 flex flex-col'>
      {/* Header */}
      <div className='bg-white border-b border-gray-200 px-4 py-3 safe-top'>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => navigate(-1)}
            className='p-1 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>
          <h1 className='flex-1 text-base font-semibold text-gray-900'>{reportTitle}</h1>
          {reportData && (
            <div className='flex gap-2'>
              <button
                onClick={handleCsv}
                className='flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200'
              >
                <FileText className='w-3.5 h-3.5' />
                CSV
              </button>
              <button
                onClick={handlePdf}
                className='flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-600 text-white text-xs font-medium hover:bg-primary-700'
              >
                <Download className='w-3.5 h-3.5' />
                PDF
              </button>
              <button
                onClick={handleShare}
                className='flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-700 text-white text-xs font-medium hover:bg-gray-800'
              >
                <Share2 className='w-3.5 h-3.5' />
                Share
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {!reportData ? (
          <div className='flex flex-col items-center justify-center py-16 text-gray-400'>
            <FileText className='w-10 h-10 mb-3' />
            <p className='text-sm'>No report data. Please generate a report first.</p>
          </div>
        ) : (
          <>
            {/* Meta info */}
            <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
              <p className='text-sm font-semibold text-gray-900'>{reportData.farmName}</p>
              {dateRangeLabel && <p className='text-xs text-gray-500 mt-0.5'>{dateRangeLabel}</p>}
              <p className='text-xs text-gray-400'>
                As of: {reportData.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : ''}
              </p>
            </div>

            {/* Report-specific content */}
            <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
              {reportType === 'batch_completion' && <BatchTable r={reportData as BatchCompletionReport} />}
              {reportType === 'cross_enterprise' && <CrossTable r={reportData as CrossEnterpriseReport} />}
              {reportType === 'farm_pnl' && <PnlTable r={reportData as FarmPnlReport} />}
              {reportType === 'cash_flow' && <CashFlowTable r={reportData as CashFlowReport} />}
              {reportType === 'inventory_status' && <InventoryTable r={reportData as InventoryStatusReport} />}
              {reportType === 'labor_cost' && <LaborTable r={reportData as LaborCostReport} />}
              {!['batch_completion','cross_enterprise','farm_pnl','cash_flow','inventory_status','labor_cost'].includes(reportType) && (
                <p className='text-sm text-gray-500'>Report type not yet supported for display.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
