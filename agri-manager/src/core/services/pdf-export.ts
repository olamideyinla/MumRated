import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { formatCurrency } from '../../core/utils/number'
import type {
  EnterpriseInstance,
  FinancialTransaction,
  FinancialCategory,
  InventoryItem,
  InventoryTransaction,
} from '../../shared/types'
import type { AnyDailyRecord } from '../database/hooks/use-daily-records'

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN: [number, number, number] = [45, 106, 79]
const WHITE: [number, number, number] = [255, 255, 255]
const LIGHT_GREEN: [number, number, number] = [240, 248, 244]
const GRAY: [number, number, number] = [100, 100, 100]
const DARK: [number, number, number] = [30, 30, 30]
const GOOD: [number, number, number] = [39, 174, 96]
const BAD: [number, number, number] = [192, 57, 43]
const NEUTRAL: [number, number, number] = [127, 140, 141]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchReportOptions {
  enterprise: EnterpriseInstance
  records: AnyDailyRecord[]
  financials: FinancialTransaction[]
  farmName: string
  currency?: string
  previousBatch?: { name: string; kpis: Record<string, string | number> }
}

interface WeekGroup {
  weekNum: number
  weekStart: string
  weekEnd: string
  records: AnyDailyRecord[]
}

interface KpiBox {
  label: string
  value: string
  indicator: string
  color: [number, number, number]
}

// ── Private helpers ───────────────────────────────────────────────────────────

function addFooter(doc: jsPDF, farmName: string): void {
  const count = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const ts = format(new Date(), 'dd MMM yyyy HH:mm')
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...NEUTRAL)
    doc.text(`${farmName}  •  Page ${i} of ${count}  •  Generated ${ts}`, w / 2, h - 5, { align: 'center' })
  }
}

function drawGreenBanner(doc: jsPDF, title: string, sub?: string): number {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, w, 30, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title.toUpperCase(), 14, 13)
  if (sub) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(sub, 14, 22)
  }
  doc.setTextColor(...DARK)
  return 40
}

function drawKpiBox(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  indicator: string, indColor: [number, number, number],
): void {
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(...LIGHT_GREEN)
  doc.rect(x, y, w, h, 'FD')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(label, x + w / 2, y + 8, { align: 'center' })
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(value, x + w / 2, y + 17, { align: 'center' })
  if (indicator) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...indColor)
    doc.text(indicator, x + w / 2, y + 24, { align: 'center' })
  }
}

function indicator(val: number, threshold: number, higherIsBetter: boolean): { text: string; color: [number, number, number] } {
  const isGood = higherIsBetter ? val >= threshold : val <= threshold
  return isGood
    ? { text: '↑ above standard', color: GOOD }
    : { text: '↓ below standard', color: BAD }
}

function groupRecordsByWeek(records: AnyDailyRecord[], startDate: string): WeekGroup[] {
  const startMs = new Date(startDate).getTime()
  const map = new Map<number, AnyDailyRecord[]>()
  for (const r of records) {
    const dayNum = Math.floor((new Date(r.date).getTime() - startMs) / 86400000)
    const wk = Math.floor(dayNum / 7) + 1
    if (!map.has(wk)) map.set(wk, [])
    map.get(wk)!.push(r)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNum, recs]) => {
      const sorted = [...recs].sort((a, b) => a.date.localeCompare(b.date))
      return { weekNum, weekStart: sorted[0].date, weekEnd: sorted[sorted.length - 1].date, records: sorted }
    })
}

function calcBroilerKpis(records: AnyDailyRecord[], enterprise: EnterpriseInstance) {
  const recs = records as Array<{ mortalityCount: number; feedConsumedKg: number; bodyWeightSampleAvg?: number; date: string }>
  const totalFeed = recs.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
  const totalDeaths = recs.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
  const initial = enterprise.initialStockCount || 1
  const mortalityPct = (totalDeaths / initial) * 100
  const weightRecs = recs.filter(r => r.bodyWeightSampleAvg != null)
  const lastWeight = weightRecs.length > 0 ? weightRecs[weightRecs.length - 1].bodyWeightSampleAvg! : null
  const durationDays = records.length > 0
    ? Math.max(1, differenceInCalendarDays(parseISO(records[records.length - 1].date), parseISO(records[0].date)) + 1)
    : 1
  const liveBirds = initial - totalDeaths
  const fcr = lastWeight && liveBirds > 0 ? totalFeed / (liveBirds * lastWeight) : null
  const adgG = lastWeight ? (lastWeight / durationDays) * 1000 : null
  const epef = fcr && lastWeight ? ((liveBirds / initial) * lastWeight * 100) / (durationDays * fcr) : null
  return { fcr, mortalityPct, adgG, epef, totalFeed, durationDays }
}

function calcLayerKpis(records: AnyDailyRecord[], enterprise: EnterpriseInstance) {
  const recs = records as Array<{ totalEggs: number; mortalityCount: number; feedConsumedKg: number; date: string }>
  const totalEggs = recs.reduce((s, r) => s + (r.totalEggs ?? 0), 0)
  const totalFeed = recs.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
  const totalDeaths = recs.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
  const stock = enterprise.currentStockCount || enterprise.initialStockCount || 1
  const initial = enterprise.initialStockCount || stock
  const days = recs.length || 1
  const hdpPct = (totalEggs / (days * stock)) * 100
  const peakPct = recs.length > 0 ? (Math.max(...recs.map(r => r.totalEggs ?? 0)) / stock) * 100 : 0
  const mortalityPct = (totalDeaths / initial) * 100
  const fcr = totalEggs > 0 ? totalFeed / (totalEggs * 0.063) : null  // 1 egg ≈ 63 g
  return { hdpPct, peakPct, mortalityPct, fcr, totalEggs, totalFeed }
}

function catLabel(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// ── createBatchReport ─────────────────────────────────────────────────────────

export function createBatchReport(opts: BatchReportOptions): Blob {
  const { enterprise, records, financials, farmName, previousBatch, currency } = opts
  const fmtAmt = (n: number) => formatCurrency(n, currency ?? 'USD')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()

  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const startDate = enterprise.startDate
  const endDate = enterprise.actualEndDate ?? enterprise.expectedEndDate
    ?? (sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].date : startDate)
  const dateRangeStr = `${startDate} → ${endDate}`
  const entTypeName = enterprise.enterpriseType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  // ── PAGE 1: Cover ───────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageWidth, 100, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(farmName, margin, 40)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('BATCH COMPLETION REPORT', margin, 52)
  doc.setFontSize(10)
  doc.text(enterprise.name, margin, 64)
  doc.text(entTypeName, margin, 72)
  doc.text(dateRangeStr, margin, 80)
  doc.setTextColor(...DARK)
  doc.setFontSize(9)
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, margin, 110)
  if (sortedRecords.length > 0) {
    doc.setTextColor(...GRAY)
    doc.text(`${sortedRecords.length} daily records included`, margin, 120)
  }

  // ── PAGE 2: Executive Summary ───────────────────────────────────────────────
  doc.addPage()
  let y = drawGreenBanner(doc, 'Executive Summary', enterprise.name)

  const income = financials.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = financials.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expenses

  let kpiBoxes: KpiBox[] = []

  if (enterprise.enterpriseType === 'broilers') {
    const k = calcBroilerKpis(sortedRecords, enterprise)
    const fcrInd = k.fcr ? indicator(k.fcr, 1.8, false) : { text: 'no data', color: NEUTRAL }
    const mortInd = indicator(k.mortalityPct, 5, false)
    const adgInd = k.adgG ? indicator(k.adgG, 50, true) : { text: 'no data', color: NEUTRAL }
    const epefInd = k.epef ? indicator(k.epef, 300, true) : { text: 'no data', color: NEUTRAL }
    kpiBoxes = [
      { label: 'FCR', value: k.fcr != null ? k.fcr.toFixed(2) : '-', indicator: fcrInd.text, color: fcrInd.color },
      { label: 'Mortality %', value: k.mortalityPct.toFixed(1) + '%', indicator: mortInd.text, color: mortInd.color },
      { label: 'ADG (g)', value: k.adgG != null ? k.adgG.toFixed(0) : '-', indicator: adgInd.text, color: adgInd.color },
      { label: 'EPEF', value: k.epef != null ? k.epef.toFixed(0) : '-', indicator: epefInd.text, color: epefInd.color },
      { label: 'Revenue', value: fmtAmt(income), indicator: '', color: GOOD },
      { label: 'Net Profit', value: fmtAmt(net), indicator: net >= 0 ? '↑ profitable' : '↓ loss', color: net >= 0 ? GOOD : BAD },
    ]
  } else if (enterprise.enterpriseType === 'layers') {
    const k = calcLayerKpis(sortedRecords, enterprise)
    const hdpInd = indicator(k.hdpPct, 80, true)
    const peakInd = indicator(k.peakPct, 85, true)
    const mortInd = indicator(k.mortalityPct, 5, false)
    const fcrInd = k.fcr ? indicator(k.fcr, 3.0, false) : { text: 'no data', color: NEUTRAL }
    kpiBoxes = [
      { label: 'HDP %', value: k.hdpPct.toFixed(1) + '%', indicator: hdpInd.text, color: hdpInd.color },
      { label: 'Peak Prod %', value: k.peakPct.toFixed(1) + '%', indicator: peakInd.text, color: peakInd.color },
      { label: 'Mortality %', value: k.mortalityPct.toFixed(1) + '%', indicator: mortInd.text, color: mortInd.color },
      { label: 'FCR', value: k.fcr != null ? k.fcr.toFixed(2) : '-', indicator: fcrInd.text, color: fcrInd.color },
      { label: 'Revenue', value: fmtAmt(income), indicator: '', color: GOOD },
      { label: 'Net Profit', value: fmtAmt(net), indicator: net >= 0 ? '↑ profitable' : '↓ loss', color: net >= 0 ? GOOD : BAD },
    ]
  } else {
    kpiBoxes = [
      { label: 'Records', value: String(sortedRecords.length), indicator: '', color: NEUTRAL },
      { label: 'Revenue', value: fmtAmt(income), indicator: '', color: GOOD },
      { label: 'Expenses', value: fmtAmt(expenses), indicator: '', color: BAD },
      { label: 'Net Profit', value: fmtAmt(net), indicator: net >= 0 ? '↑ profitable' : '↓ loss', color: net >= 0 ? GOOD : BAD },
    ]
  }

  const boxW = (pageWidth - margin * 2 - 4 * 2) / 3
  const boxH = 28
  for (let i = 0; i < kpiBoxes.length; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const bx = margin + col * (boxW + 4)
    const by = y + row * (boxH + 4)
    const box = kpiBoxes[i]
    drawKpiBox(doc, bx, by, boxW, boxH, box.label, box.value, box.indicator, box.color)
  }

  const rowCount = Math.ceil(kpiBoxes.length / 3)
  y += rowCount * (boxH + 4) + 8

  // Overall assessment
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  const assessment = net >= 0
    ? `Batch achieved positive returns with ${fmtAmt(net)} net profit. ${income > 0 ? `Gross margin: ${((net / income) * 100).toFixed(1)}%.` : ''}`
    : `Batch recorded a loss of ${fmtAmt(Math.abs(net))}. Review feed costs and revenue streams.`
  const lines = doc.splitTextToSize(assessment, pageWidth - margin * 2) as string[]
  doc.text(lines, margin, y)

  // ── PAGE 3: Production Data ─────────────────────────────────────────────────
  doc.addPage()
  y = drawGreenBanner(doc, 'Production Data', `Weekly breakdown — ${sortedRecords.length} records`)

  const weeks = groupRecordsByWeek(sortedRecords, startDate)

  if (weeks.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text('No production records available.', margin, y)
  } else {
    let head: string[][]
    let body: string[][]

    if (enterprise.enterpriseType === 'broilers') {
      head = [['Week', 'Days', 'Birds Alive', 'Deaths', 'Feed (kg)', 'Avg Weight (kg)', 'FCR']]
      body = weeks.map(wk => {
        const recs = wk.records as Array<{ mortalityCount: number; feedConsumedKg: number; bodyWeightSampleAvg?: number }>
        const deaths = recs.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
        const feed = recs.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
        const weightRecs = recs.filter(r => r.bodyWeightSampleAvg != null)
        const lastWeight = weightRecs.length > 0 ? weightRecs[weightRecs.length - 1].bodyWeightSampleAvg! : null
        const alive = enterprise.currentStockCount
        const wkFcr = lastWeight && alive > 0 ? (feed / (alive * lastWeight)).toFixed(2) : '-'
        return [
          `Wk ${wk.weekNum}`, String(recs.length), String(alive),
          String(deaths), feed.toFixed(1),
          lastWeight != null ? lastWeight.toFixed(2) : '-', wkFcr,
        ]
      })
    } else if (enterprise.enterpriseType === 'layers') {
      head = [['Week', 'Days', 'Birds', 'Deaths', 'Eggs', 'HDP %', 'Feed (kg)']]
      body = weeks.map(wk => {
        const recs = wk.records as Array<{ totalEggs: number; mortalityCount: number; feedConsumedKg: number }>
        const deaths = recs.reduce((s, r) => s + (r.mortalityCount ?? 0), 0)
        const eggs = recs.reduce((s, r) => s + (r.totalEggs ?? 0), 0)
        const feed = recs.reduce((s, r) => s + (r.feedConsumedKg ?? 0), 0)
        const stock = enterprise.currentStockCount || 1
        const hdp = ((eggs / (recs.length * stock)) * 100).toFixed(1)
        return [
          `Wk ${wk.weekNum}`, String(recs.length), String(stock),
          String(deaths), String(eggs), hdp + '%', feed.toFixed(1),
        ]
      })
    } else {
      head = [['Week', 'Date Range', 'Feed (kg)', 'Mortality', 'Notes']]
      body = weeks.map(wk => {
        const recs = wk.records as Array<{ feedConsumedKg?: number; feedGivenKg?: number; mortalityCount?: number; deaths?: number; estimatedMortality?: number; notes?: string }>
        const feed = recs.reduce((s, r) => s + (r.feedConsumedKg ?? r.feedGivenKg ?? 0), 0)
        const mort = recs.reduce((s, r) => s + (r.mortalityCount ?? r.deaths ?? r.estimatedMortality ?? 0), 0)
        const noteRecs = recs.filter(r => r.notes).map(r => r.notes!)
        return [
          `Wk ${wk.weekNum}`, `${wk.weekStart} – ${wk.weekEnd}`,
          feed.toFixed(1), String(mort), noteRecs.slice(0, 1).join('; '),
        ]
      })
    }

    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT_GREEN },
    })
  }

  // ── PAGE 4: Financial Summary ───────────────────────────────────────────────
  doc.addPage()
  y = drawGreenBanner(doc, 'Financial Summary', enterprise.name)

  const incomeByCategory = new Map<FinancialCategory, number>()
  const expenseByCategory = new Map<FinancialCategory, number>()
  for (const t of financials) {
    if (t.type === 'income') incomeByCategory.set(t.category, (incomeByCategory.get(t.category) ?? 0) + t.amount)
    else expenseByCategory.set(t.category, (expenseByCategory.get(t.category) ?? 0) + t.amount)
  }

  if (incomeByCategory.size > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Income Category', 'Amount']],
      body: Array.from(incomeByCategory.entries()).map(([cat, amt]) => [catLabel(cat), fmtAmt(amt)]),
      foot: [['Total Income', fmtAmt(income)]],
      margin: { left: margin, right: margin },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      footStyles: { fillColor: [220, 240, 230], textColor: DARK, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  if (expenseByCategory.size > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Expense Category', 'Amount']],
      body: Array.from(expenseByCategory.entries()).map(([cat, amt]) => [catLabel(cat), fmtAmt(amt)]),
      foot: [['Total Expenses', fmtAmt(expenses)]],
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [180, 50, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      footStyles: { fillColor: [250, 220, 220], textColor: DARK, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // Gross margin row
  const stockCount = enterprise.currentStockCount || enterprise.initialStockCount || 1
  autoTable(doc, {
    startY: y,
    body: [
      ['Gross Margin', fmtAmt(net)],
      ['Margin %', income > 0 ? ((net / income) * 100).toFixed(1) + '%' : '-'],
      ['Cost per animal', fmtAmt(expenses / stockCount)],
      ['Revenue per animal', income > 0 ? fmtAmt(income / stockCount) : '-'],
    ],
    margin: { left: margin, right: margin },
    bodyStyles: { fontSize: 9, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    theme: 'plain',
  })

  // ── PAGE 5: Comparison (optional) ──────────────────────────────────────────
  if (previousBatch) {
    doc.addPage()
    y = drawGreenBanner(doc, 'Batch Comparison', `${enterprise.name} vs ${previousBatch.name}`)

    const currentKpis: Record<string, string | number> = {}
    if (enterprise.enterpriseType === 'broilers') {
      const k = calcBroilerKpis(sortedRecords, enterprise)
      if (k.fcr != null) currentKpis['FCR'] = k.fcr.toFixed(2)
      currentKpis['Mortality %'] = k.mortalityPct.toFixed(1) + '%'
      if (k.adgG != null) currentKpis['ADG (g)'] = k.adgG.toFixed(0)
      if (k.epef != null) currentKpis['EPEF'] = k.epef.toFixed(0)
    } else if (enterprise.enterpriseType === 'layers') {
      const k = calcLayerKpis(sortedRecords, enterprise)
      currentKpis['HDP %'] = k.hdpPct.toFixed(1) + '%'
      currentKpis['Peak Prod %'] = k.peakPct.toFixed(1) + '%'
      currentKpis['Mortality %'] = k.mortalityPct.toFixed(1) + '%'
      if (k.fcr != null) currentKpis['FCR'] = k.fcr.toFixed(2)
    }
    currentKpis['Revenue'] = fmtAmt(income)
    currentKpis['Net Profit'] = fmtAmt(net)

    const allMetrics = new Set([...Object.keys(currentKpis), ...Object.keys(previousBatch.kpis)])
    const compBody: string[][] = []
    for (const metric of allMetrics) {
      const cur = currentKpis[metric] ?? '-'
      const prev = previousBatch.kpis[metric] ?? '-'
      const diff = typeof cur === 'string' && typeof prev === 'string'
        ? (cur !== '-' && prev !== '-' ? '' : '-')
        : '-'
      compBody.push([metric, String(cur), String(prev), diff])
    }

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'This Batch', 'Previous', 'Difference']],
      body: compBody,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT_GREEN },
    })
  }

  addFooter(doc, farmName)
  return doc.output('blob')
}

// ── createFarmPnLReport ───────────────────────────────────────────────────────

export function createFarmPnLReport(opts: {
  dateRange: { from: string; to: string }
  transactions: FinancialTransaction[]
  farmName: string
  currency?: string
  enterpriseNames?: Map<string, string>
}): Blob {
  const { dateRange, transactions, farmName, currency, enterpriseNames } = opts
  const fmtAmt = (n: number) => formatCurrency(n, currency ?? 'USD')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14

  let y = drawGreenBanner(doc, 'Farm Income Statement', `${dateRange.from} to ${dateRange.to}`)

  const daysDiff = differenceInCalendarDays(parseISO(dateRange.to), parseISO(dateRange.from))
  const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort()

  if (daysDiff > 31 && months.length > 1) {
    // Monthly pivot: categories as rows, months as columns
    const incomeCats = [...new Set(transactions.filter(t => t.type === 'income').map(t => t.category))]
    const expenseCats = [...new Set(transactions.filter(t => t.type === 'expense').map(t => t.category))]

    const buildPivotBody = (cats: FinancialCategory[], type: 'income' | 'expense') => {
      const totalsRow = ['Total', ...months.map(() => ''), '']
      const monthTotals = new Array(months.length).fill(0)
      const rows: string[][] = cats.map(cat => {
        let grandTotal = 0
        const cols = months.map((mo, mi) => {
          const amt = transactions
            .filter(t => t.type === type && t.category === cat && t.date.startsWith(mo))
            .reduce((s, t) => s + t.amount, 0)
          monthTotals[mi] += amt
          grandTotal += amt
          return amt > 0 ? fmtAmt(amt) : '-'
        })
        return [catLabel(cat), ...cols, fmtAmt(grandTotal)]
      })
      const grandTotal = monthTotals.reduce((s, v) => s + v, 0)
      totalsRow.splice(1, months.length, ...monthTotals.map(v => fmtAmt(v)))
      totalsRow[months.length + 1] = fmtAmt(grandTotal)
      return { rows, totalsRow }
    }

    const { rows: incRows, totalsRow: incTotals } = buildPivotBody(incomeCats as FinancialCategory[], 'income')
    const { rows: expRows, totalsRow: expTotals } = buildPivotBody(expenseCats as FinancialCategory[], 'expense')
    const head = [['Category', ...months.map(m => format(parseISO(m + '-01'), 'MMM yy')), 'Total']]

    if (incRows.length > 0) {
      autoTable(doc, {
        startY: y, head,
        body: incRows,
        foot: [incTotals],
        margin: { left: margin, right: margin },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [220, 240, 230], fontStyle: 'bold', fontSize: 7 },
      })
      y = (doc as any).lastAutoTable.finalY + 6
    }
    if (expRows.length > 0) {
      autoTable(doc, {
        startY: y, head,
        body: expRows,
        foot: [expTotals],
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [180, 50, 40], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [250, 220, 220], fontStyle: 'bold', fontSize: 7 },
      })
    }
  } else {
    // Simple single-period layout
    const income = transactions.filter(t => t.type === 'income')
    const expenses = transactions.filter(t => t.type === 'expense')
    const totalIncome = income.reduce((s, t) => s + t.amount, 0)
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)

    const incomeByCat = new Map<string, number>()
    for (const t of income) incomeByCat.set(t.category, (incomeByCat.get(t.category) ?? 0) + t.amount)
    const expenseByCat = new Map<string, number>()
    for (const t of expenses) expenseByCat.set(t.category, (expenseByCat.get(t.category) ?? 0) + t.amount)

    if (incomeByCat.size > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Revenue', 'Amount']],
        body: Array.from(incomeByCat.entries()).map(([c, a]) => [catLabel(c), fmtAmt(a)]),
        foot: [['Total Revenue', fmtAmt(totalIncome)]],
        margin: { left: margin, right: margin },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [220, 240, 230], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 1: { halign: 'right' } },
      })
      y = (doc as any).lastAutoTable.finalY + 6
    }
    if (expenseByCat.size > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Expenses', 'Amount']],
        body: Array.from(expenseByCat.entries()).map(([c, a]) => [catLabel(c), fmtAmt(a)]),
        foot: [['Total Expenses', fmtAmt(totalExpenses)]],
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [180, 50, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [250, 220, 220], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 1: { halign: 'right' } },
      })
      y = (doc as any).lastAutoTable.finalY + 6
    }

    const net = totalIncome - totalExpenses
    autoTable(doc, {
      startY: y,
      body: [
        ['Net Profit / Loss', (net >= 0 ? '+' : '') + fmtAmt(Math.abs(net))],
        ['Gross Margin', totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) + '%' : '-'],
      ],
      margin: { left: margin, right: margin },
      bodyStyles: { fontSize: 10, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      theme: 'plain',
    })

    // Enterprise breakdown if names available
    if (enterpriseNames && enterpriseNames.size > 0) {
      y = (doc as any).lastAutoTable.finalY + 8
      const entMap = new Map<string, { income: number; expenses: number }>()
      for (const t of transactions) {
        if (!t.enterpriseInstanceId) continue
        const cur = entMap.get(t.enterpriseInstanceId) ?? { income: 0, expenses: 0 }
        if (t.type === 'income') cur.income += t.amount
        else cur.expenses += t.amount
        entMap.set(t.enterpriseInstanceId, cur)
      }
      if (entMap.size > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Enterprise', 'Income', 'Expenses', 'Net']],
          body: Array.from(entMap.entries()).map(([id, v]) => [
            enterpriseNames.get(id) ?? id.slice(0, 8),
            fmtAmt(v.income), fmtAmt(v.expenses),
            fmtAmt(v.income - v.expenses),
          ]),
          margin: { left: margin, right: margin },
          headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: LIGHT_GREEN },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        })
      }
    }
  }

  addFooter(doc, farmName)
  return doc.output('blob')
}

// ── createInventoryReport ─────────────────────────────────────────────────────

export function createInventoryReport(opts: {
  items: InventoryItem[]
  transactions: InventoryTransaction[]
  farmName: string
  currency?: string
}): Blob {
  const { items, transactions, farmName, currency } = opts
  const fmtAmt = (n: number) => formatCurrency(n, currency ?? 'USD')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14

  let y = drawGreenBanner(doc, 'Inventory Report', `As of ${format(new Date(), 'dd MMM yyyy')}`)

  // Table 1: Current Stock
  autoTable(doc, {
    startY: y,
    head: [['Name', 'Category', 'Stock', 'Unit', 'Reorder Pt', 'Status']],
    body: items.map(item => {
      const isOut = item.currentStock === 0
      const isLow = item.reorderPoint != null && item.currentStock <= item.reorderPoint
      const status = isOut ? 'Out' : isLow ? 'Low' : 'OK'
      return [
        item.name,
        catLabel(item.category),
        item.currentStock.toLocaleString(),
        item.unitOfMeasurement,
        item.reorderPoint != null ? String(item.reorderPoint) : '-',
        status,
      ]
    }),
    margin: { left: margin, right: margin },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GREEN },
  })

  y = (doc as any).lastAutoTable.finalY + 8

  // Table 2: Movement Summary (last 90 days)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const recentTxns = transactions.filter(t => t.date >= cutoffStr)
  const itemMap = new Map(items.map(i => [i.id, i]))

  if (recentTxns.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Item', 'Type', 'Qty', 'Unit Cost', 'Reference']],
      body: recentTxns
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 100)
        .map(t => {
          const item = itemMap.get(t.inventoryItemId)
          return [
            t.date,
            item?.name ?? '-',
            t.type.toUpperCase(),
            (t.type === 'out' ? '-' : '+') + t.quantity,
            t.unitCost != null ? fmtAmt(t.unitCost) : '-',
            t.reference ?? '-',
          ]
        }),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [80, 120, 100], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT_GREEN },
    })
  }

  addFooter(doc, farmName)
  return doc.output('blob')
}

// ── createComplianceReport ────────────────────────────────────────────────────

export function createComplianceReport(opts: {
  enterprise: EnterpriseInstance
  records: AnyDailyRecord[]
  farmName: string
}): Blob {
  const { enterprise, records, farmName } = opts
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  const isCrop = enterprise.enterpriseType.startsWith('crop_')

  let y = drawGreenBanner(
    doc,
    isCrop ? 'Input Application Log' : 'Health & Treatment Log',
    `${enterprise.name} — ${enterprise.enterpriseType.replace(/_/g, ' ')}`,
  )

  if (isCrop) {
    const INPUT_TYPES = ['pesticide_application', 'herbicide_application', 'fungicide_application', 'fertilizer_application', 'fertilizing', 'spraying']
    const cropRecs = (records as Array<{ date: string; activityType: string; inputUsed?: string; inputQuantity?: number; inputUnit?: string; workerCount?: number; recordedBy: string; notes?: string }>)
      .filter(r => INPUT_TYPES.includes(r.activityType))
      .sort((a, b) => a.date.localeCompare(b.date))

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Activity', 'Input Used', 'Qty', 'Unit', 'Workers', 'Applicator', 'Notes']],
      body: cropRecs.map(r => [
        r.date,
        r.activityType.replace(/_/g, ' '),
        r.inputUsed ?? '-',
        r.inputQuantity != null ? String(r.inputQuantity) : '-',
        r.inputUnit ?? '-',
        r.workerCount != null ? String(r.workerCount) : '-',
        r.recordedBy,
        r.notes ?? '-',
      ]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT_GREEN },
    })
  } else {
    const liveRecs = (records as Array<{ date: string; mortalityCount?: number; deaths?: number; mortalityCause?: string; healthNotes?: string; recordedBy: string; notes?: string }>)
      .sort((a, b) => a.date.localeCompare(b.date))

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Deaths', 'Mortality Cause', 'Health Notes', 'Recorded By']],
      body: liveRecs.map(r => [
        r.date,
        String(r.mortalityCount ?? r.deaths ?? 0),
        r.mortalityCause ?? '-',
        r.healthNotes ?? r.notes ?? '-',
        r.recordedBy,
      ]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT_GREEN },
    })
  }

  // Regulatory declaration
  const pageHeight = doc.internal.pageSize.getHeight()
  const decl = 'This record has been generated from farm management records and is provided for inspection and compliance purposes. Data is recorded at point of activity by farm personnel.'
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  const declLines = doc.splitTextToSize(decl, pageWidth - margin * 2) as string[]
  doc.text(declLines, margin, pageHeight - 20)

  addFooter(doc, farmName)
  return doc.output('blob')
}
