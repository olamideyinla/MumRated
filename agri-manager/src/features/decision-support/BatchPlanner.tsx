import { useState, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Save } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuthStore } from '../../stores/auth-store'
import { useCurrency } from '../../shared/hooks/useCurrency'
import { db } from '../../core/database/db'
import { newId, nowIso } from '../../shared/types/base'
import {
  planBroilerBatch, planLayerBatch, ROSS308_VACCINATIONS, LOHMANN_VACCINATIONS,
  type BatchPlan,
} from '../../core/constants/breed-standards'
import type { EnterpriseType } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPORTED_TYPES: { value: EnterpriseType; label: string; emoji: string }[] = [
  { value: 'broilers', label: 'Broilers',   emoji: '🐔' },
  { value: 'layers',   label: 'Layers',     emoji: '🥚' },
]

const PIE_COLORS = ['#2D6A4F', '#DAA520', '#8B6914', '#10b981', '#3b82f6']

// ── Helpers ───────────────────────────────────────────────────────────────────

function InputRow({ label, value, onChange, step = 1, suffix = '', min = 0 }: {
  label: string; value: number; onChange: (n: number) => void
  step?: number; suffix?: string; min?: number
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" value={value} min={min} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {suffix && <span className="text-xs text-gray-400 w-10">{suffix}</span>}
      </div>
    </div>
  )
}

// ── PDF Export ────────────────────────────────────────────────────────────────

function exportPDF(plan: BatchPlan, orgName: string, fmt: (n: number) => string) {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Batch Plan', 14, 20)
  doc.setFontSize(11)
  doc.text(`${orgName} · ${new Date().toLocaleDateString()}`, 14, 28)
  doc.setFontSize(10)
  doc.text(`Enterprise: ${plan.enterpriseType} · Stock: ${plan.stockCount.toLocaleString()} · Start: ${plan.startDate}`, 14, 35)

  autoTable(doc, {
    startY: 42,
    head: [['Week', 'Birds', 'Feed (kg)', 'Cash Out', 'Cash In', 'Note']],
    body: plan.weeklyProjections.map(p => [
      p.week, p.birdCount.toLocaleString(), p.feedKg.toLocaleString(),
      fmt(p.cashOut), p.cashIn > 0 ? fmt(p.cashIn) : '—', p.note ?? '',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 106, 79] },
  })

  const y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(10)
  doc.text(`Total Feed: ${plan.totalFeedKg.toLocaleString()} kg`, 14, y)
  doc.text(`Total Cost: ${fmt(plan.totalCost)}`, 14, y + 6)
  doc.text(`Expected Revenue: ${fmt(plan.expectedRevenue)}`, 14, y + 12)
  doc.text(`Expected ROI: ${plan.expectedROI.toFixed(1)}%`, 14, y + 18)

  doc.save(`batch-plan-${plan.enterpriseType}-${plan.startDate}.pdf`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BatchPlanner() {
  const navigate  = useNavigate()
  const appUser   = useAuthStore(s => s.appUser)
  const { fmt, currency } = useCurrency()
  const sym = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currency ?? 'USD', currencyDisplay: 'narrowSymbol',
      }).formatToParts(1).find(p => p.type === 'currency')?.value ?? currency ?? '$'
    } catch { return '$' }
  }, [currency])
  const [saving,  setSaving] = useState(false)
  const [saved,   setSaved]  = useState(false)

  // Form state
  const [enterpriseType, setEnterpriseType] = useState<'broilers' | 'layers'>('broilers')
  const [stockCount,     setStockCount]     = useState(1000)
  const [startDate,      setStartDate]      = useState(() => new Date().toISOString().slice(0, 10))
  const [infrastructureId, setInfrastructureId] = useState('')

  // Broiler params
  const [slaughterWeek,     setSlaughterWeek]     = useState(6)
  const [feedPricePerKg,    setFeedPricePerKg]    = useState(0.45)
  const [chickCostPerBird,  setChickCostPerBird]  = useState(0.80)
  const [salePricePerKg,    setSalePricePerKg]    = useState(2.20)
  const [laborWeekly,       setLaborWeekly]       = useState(50)
  // Layer params
  const [layingWeeks,    setLayingWeeks]    = useState(52)
  const [eggPricePerTray, setEggPricePerTray] = useState(4.00)
  const [pulletCostPerBird, setPulletCostPerBird] = useState(2.50)

  const infrastructures = useLiveQuery(async () => {
    if (!appUser) return []
    const locs = await db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray()
    return db.infrastructures.where('farmLocationId').anyOf(locs.map(l => l.id)).toArray()
  }, [appUser?.organizationId])

  const orgName = useLiveQuery(async () => {
    if (!appUser) return ''
    const org = await db.organizations.get(appUser.organizationId)
    return org?.name ?? ''
  }, [appUser?.organizationId])

  const plan = useMemo<BatchPlan>(() => {
    if (enterpriseType === 'broilers') {
      return planBroilerBatch({ stockCount, startDate, slaughterWeek, feedPricePerKg, chickCostPerBird, salePricePerKg, laborWeekly })
    }
    return planLayerBatch({ stockCount, startDate, layingWeeks, feedPricePerKg, pulletCostPerBird: pulletCostPerBird, eggPricePerTray, laborWeekly })
  }, [enterpriseType, stockCount, startDate, slaughterWeek, feedPricePerKg, chickCostPerBird, salePricePerKg, laborWeekly, layingWeeks, pulletCostPerBird, eggPricePerTray])

  // Show first 24 weeks of cash flow chart to keep mobile readable
  const cashFlowData = plan.weeklyProjections.slice(0, 24)

  const vaccSchedule = enterpriseType === 'broilers' ? ROSS308_VACCINATIONS : LOHMANN_VACCINATIONS

  const handleSavePlan = useCallback(async () => {
    if (!appUser || !infrastructureId) return
    setSaving(true)
    const now = nowIso()
    await db.enterpriseInstances.put({
      id: newId(),
      organizationId: appUser.organizationId,
      infrastructureId,
      enterpriseType,
      name: `Planned ${enterpriseType} ${startDate}`,
      startDate,
      expectedEndDate: (() => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + plan.durationWeeks * 7)
        return d.toISOString().slice(0, 10)
      })(),
      status: 'planned',
      initialStockCount: stockCount,
      currentStockCount: stockCount,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    } as Parameters<typeof db.enterpriseInstances.put>[0])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }, [appUser, infrastructureId, enterpriseType, startDate, stockCount, plan.durationWeeks])

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Plan a New Batch</h1>
          <button onClick={() => exportPDF(plan, orgName ?? '', fmt)}
            className="flex items-center gap-1 text-xs text-gray-500 border border-gray-300 px-2.5 py-1.5 rounded-lg">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Enterprise type */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enterprise Type</p>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_TYPES.map(t => (
              <button key={t.value}
                onClick={() => setEnterpriseType(t.value as 'broilers' | 'layers')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-colors
                  ${enterpriseType === t.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className={`text-sm font-semibold ${enterpriseType === t.value ? 'text-primary-700' : 'text-gray-600'}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Basic params */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Batch Parameters</p>
          <div className="py-2 border-b border-gray-100">
            <label className="text-sm text-gray-600">Start date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="input text-sm mt-1" />
          </div>
          <InputRow label="Stock count" value={stockCount} onChange={setStockCount} step={100} suffix="birds" />
          <InputRow label="Labor (weekly)" value={laborWeekly} onChange={setLaborWeekly} step={10} suffix={`${sym}/wk`} />

          {enterpriseType === 'broilers' ? (
            <>
              <InputRow label="Slaughter age" value={slaughterWeek} onChange={v => setSlaughterWeek(Math.round(v))} step={1} min={4} suffix="weeks" />
              <InputRow label="Chick cost" value={chickCostPerBird} onChange={setChickCostPerBird} step={0.05} suffix={`${sym}/bird`} />
              <InputRow label="Feed cost" value={feedPricePerKg} onChange={setFeedPricePerKg} step={0.01} suffix={`${sym}/kg`} />
              <InputRow label="Sale price" value={salePricePerKg} onChange={setSalePricePerKg} step={0.05} suffix={`${sym}/kg live`} />
            </>
          ) : (
            <>
              <InputRow label="Laying period" value={layingWeeks} onChange={v => setLayingWeeks(Math.round(v))} step={4} min={20} suffix="weeks" />
              <InputRow label="Pullet cost" value={pulletCostPerBird} onChange={setPulletCostPerBird} step={0.10} suffix={`${sym}/bird`} />
              <InputRow label="Feed cost" value={feedPricePerKg} onChange={setFeedPricePerKg} step={0.01} suffix={`${sym}/kg`} />
              <InputRow label="Egg price" value={eggPricePerTray} onChange={setEggPricePerTray} step={0.10} suffix={`${sym}/tray`} />
            </>
          )}
        </div>

        {/* Save as plan */}
        {infrastructures && infrastructures.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Save as Planned Enterprise</p>
            <select value={infrastructureId} onChange={e => setInfrastructureId(e.target.value)} className="input text-sm">
              <option value="">Select infrastructure…</option>
              {infrastructures.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <button onClick={handleSavePlan} disabled={!infrastructureId || saving}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save as Plan'}
            </button>
          </div>
        )}

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Feed',    value: `${plan.totalFeedKg.toLocaleString()} kg` },
            { label: 'Total Cost',    value: fmt(plan.totalCost) },
            { label: 'Est. Revenue',  value: fmt(plan.expectedRevenue) },
            { label: 'Est. ROI',      value: `${plan.expectedROI.toFixed(1)}%`, accent: plan.expectedROI >= 0 ? 'text-emerald-600' : 'text-red-600' },
          ].map(({ label, value, accent }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className={`text-lg font-bold mt-0.5 ${accent ?? 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Cash flow chart */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Cash Flow (first 24 weeks)</p>
          <p className="text-xs text-gray-400 mb-3">Red = costs · Green = revenue</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cashFlowData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                tickFormatter={v => `${sym}${Math.abs(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v: number, name: string) => [fmt(Math.abs(v)), name === 'cashOut' ? 'Cost' : 'Revenue']} />
              <Bar dataKey="cashOut" name="cashOut" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="cashIn"  name="cashIn"  fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost breakdown */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Cost Breakdown</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={plan.costBreakdown} dataKey="amount" nameKey="category"
                cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}
                labelLine={{ fontSize: 9 }}>
                {plan.costBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [fmt(v)]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Vaccination schedule */}
        <div className="card">
          <p className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Vaccination Schedule
          </p>
          <div className="divide-y divide-gray-100">
            {vaccSchedule.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs font-mono text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full w-16 text-center shrink-0">
                  {'day' in v ? `Day ${v.day}` : `Wk ${v.weekOfAge}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{v.name}</p>
                  <p className="text-xs text-gray-400">{v.route}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly feed table */}
        <div className="card overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Week-by-Week Projection
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {['Wk', 'Birds', 'Feed kg', 'Cost', 'Revenue'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plan.weeklyProjections.map(p => (
                  <tr key={p.week} className={p.cashIn > 0 ? 'bg-emerald-50' : ''}>
                    <td className="px-3 py-2 font-medium text-gray-700">{p.week}</td>
                    <td className="px-3 py-2 text-gray-600">{p.birdCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600">{p.feedKg.toLocaleString()}</td>
                    <td className="px-3 py-2 text-red-600">{fmt(p.cashOut)}</td>
                    <td className="px-3 py-2 text-emerald-600">{p.cashIn > 0 ? fmt(p.cashIn) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
