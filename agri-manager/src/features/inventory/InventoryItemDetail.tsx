// src/features/inventory/InventoryItemDetail.tsx
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { ArrowLeft, Edit2, TrendingUp } from 'lucide-react'
import { db } from '../../core/database/db'
import { useAuthStore } from '../../stores/auth-store'
import { nowIso } from '../../shared/types'
import type { InventoryCategory, InventoryItem, InventoryTransaction } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  feed: 'Feed', medication: 'Medication', fertilizer: 'Fertilizer',
  seed: 'Seed', chemical: 'Chemical', fuel: 'Fuel',
  packaging: 'Packaging', produce: 'Produce', other: 'Other',
}

const CATEGORY_COLORS: Record<InventoryCategory, string> = {
  feed: '#2D6A4F', medication: '#DAA520', fertilizer: '#52b788',
  seed: '#f97316', chemical: '#8b5cf6', fuel: '#3b82f6',
  packaging: '#ec4899', produce: '#10b981', other: '#9ca3af',
}

const PIE_COLORS = [
  '#2D6A4F', '#52b788', '#DAA520', '#f97316',
  '#8B6914', '#3b82f6', '#8b5cf6', '#ec4899',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TxnBadge({ type }: { type: InventoryTransaction['type'] }) {
  if (type === 'in')
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">IN</span>
  if (type === 'out')
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 uppercase">OUT</span>
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">ADJ</span>
}

// ── Reorder settings ──────────────────────────────────────────────────────────

function ReorderSettings({ item }: { item: InventoryItem }) {
  const [rp, setRp] = useState(item.reorderPoint    != null ? String(item.reorderPoint)    : '')
  const [rq, setRq] = useState(item.reorderQuantity != null ? String(item.reorderQuantity) : '')

  const save = async () => {
    await db.inventoryItems.update(item.id, {
      reorderPoint:    rp.trim() !== '' ? parseFloat(rp) : undefined,
      reorderQuantity: rq.trim() !== '' ? parseFloat(rq) : undefined,
      updatedAt:       nowIso(),
      syncStatus:      'pending',
    })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Edit2 size={14} className="text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">Reorder Settings</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reorder point ({item.unitOfMeasurement})</label>
          <input type="number" min="0" value={rp}
            onChange={e => setRp(e.target.value)} onBlur={save}
            placeholder="e.g. 50" className="input-base text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reorder qty ({item.unitOfMeasurement})</label>
          <input type="number" min="0" value={rq}
            onChange={e => setRq(e.target.value)} onBlur={save}
            placeholder="e.g. 200" className="input-base text-sm" />
        </div>
      </div>
      <p className="text-xs text-gray-400">Changes save automatically on blur.</p>
    </div>
  )
}

// ── Stock trend chart ─────────────────────────────────────────────────────────

function StockTrendChart({ transactions, currentStock, unit }: {
  transactions: InventoryTransaction[]
  currentStock: number
  unit: string
}) {
  const chartData = useMemo(() => {
    const cutoff = (() => {
      const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]
    })()

    const dailyDeltas = new Map<string, number>()
    for (const t of transactions) {
      const delta = t.type === 'in' ? t.quantity : t.type === 'out' ? -t.quantity : t.quantity
      dailyDeltas.set(t.date, (dailyDeltas.get(t.date) ?? 0) + delta)
    }

    const inWindow = transactions.filter(t => t.date >= cutoff)
    const today    = new Date().toISOString().split('T')[0]
    const allDates = [...new Set([...inWindow.map(t => t.date), today])].sort()

    let running = currentStock
    const points: Array<{ date: string; stock: number }> = []
    for (let i = allDates.length - 1; i >= 0; i--) {
      points.unshift({ date: allDates[i], stock: Math.max(0, Math.round(running)) })
      if (i > 0) running -= (dailyDeltas.get(allDates[i]) ?? 0)
    }
    return points.slice(-60)
  }, [transactions, currentStock])

  if (chartData.length < 2) {
    return (
      <div className="h-36 flex items-center justify-center text-xs text-gray-400">
        Not enough data to show trend
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={fmtDate}
          tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
          unit={` ${unit}`} width={55} />
        <Tooltip formatter={(v: number) => [`${v} ${unit}`, 'Stock']} labelFormatter={fmtDate}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        <Area type="monotone" dataKey="stock" stroke="#7c3aed" strokeWidth={2}
          fill="url(#stockGrad)" dot={false} activeDot={{ r: 4, fill: '#7c3aed' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Consumption pie ───────────────────────────────────────────────────────────

function ConsumptionPie({ transactions, unit }: { transactions: InventoryTransaction[]; unit: string }) {
  const userId = useAuthStore(s => s.user?.id)

  const pieData = useLiveQuery(async () => {
    const outTxns = transactions.filter(t => t.type === 'out')
    if (outTxns.length === 0) return []

    const entIds = [...new Set(
      outTxns.map(t => t.enterpriseInstanceId).filter((id): id is string => id != null)
    )]
    const enterprises = entIds.length > 0 ? await db.enterpriseInstances.bulkGet(entIds) : []
    const entMap = new Map<string, string>()
    for (const e of enterprises) { if (e) entMap.set(e.id, e.name) }

    const byEnt = new Map<string, number>()
    for (const t of outTxns) {
      const key = t.enterpriseInstanceId ? (entMap.get(t.enterpriseInstanceId) ?? 'Enterprise') : 'General'
      byEnt.set(key, (byEnt.get(key) ?? 0) + t.quantity)
    }
    return [...byEnt.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, userId]) ?? []

  if (pieData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-gray-400">
        No consumption data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70}
          paddingAngle={2} dataKey="value" animationDuration={600}>
          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => [`${v} ${unit}`, '']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryItemDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const item = useLiveQuery(
    () => (id ? db.inventoryItems.get(id) : undefined),
    [id],
  )

  const transactions = useLiveQuery(
    () => id
      ? db.inventoryTransactions.where('inventoryItemId').equals(id)
          .sortBy('date').then(arr => arr.reverse())
      : Promise.resolve([]),
    [id],
  )

  if (item === undefined || transactions === undefined) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-dvh bg-white flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">Item not found</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary-600 font-semibold">Go back</button>
      </div>
    )
  }

  const isLow = item.reorderPoint != null && item.currentStock <= item.reorderPoint
  const isOut = item.currentStock === 0

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2 text-gray-600">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{item.name}</h1>
            <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[item.category] + '22', color: CATEGORY_COLORS[item.category] }}>
              {CATEGORY_LABELS[item.category]}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-8">
        {/* Stock count hero */}
        <div className={`card text-center py-6 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-amber-200 bg-amber-50' : 'border-emerald-100'}`}>
          <p className={`text-5xl font-black tracking-tight ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
            {item.currentStock.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{item.unitOfMeasurement} in stock</p>
          {isOut  && <p className="text-xs font-semibold text-red-600 mt-1">Out of stock</p>}
          {!isOut && isLow && (
            <p className="text-xs font-semibold text-amber-600 mt-1">
              Below reorder point ({item.reorderPoint} {item.unitOfMeasurement})
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate(`/inventory/receive?itemId=${item.id}`)}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 text-white font-semibold text-sm active:bg-primary-700 transition-colors shadow-sm">
            Receive Stock
          </button>
          <button onClick={() => navigate(`/inventory/issue?itemId=${item.id}`)}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border-2 border-primary-200 text-primary-700 font-semibold text-sm active:bg-primary-50 transition-colors">
            Issue Stock
          </button>
        </div>
        <button onClick={() => navigate(`/inventory/adjust?itemId=${item.id}`)}
          className="w-full py-2.5 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm active:bg-gray-50 transition-colors">
          Adjust Stock Count
        </button>

        {/* Reorder settings */}
        <ReorderSettings item={item} />

        {/* Stock trend */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-violet-500" />
            <p className="text-sm font-semibold text-gray-700">Stock Level Trend</p>
            <span className="text-xs text-gray-400">Last 90 days</span>
          </div>
          <StockTrendChart transactions={transactions} currentStock={item.currentStock} unit={item.unitOfMeasurement} />
        </div>

        {/* Consumption pie */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-1">Consumption by Enterprise</p>
          <p className="text-xs text-gray-400 mb-3">Where this item has been issued</p>
          <ConsumptionPie transactions={transactions} unit={item.unitOfMeasurement} />
        </div>

        {/* Recent transactions */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Transactions</p>
          </div>
          {transactions.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-400">No transactions yet</div>
          )}
          <div className="divide-y divide-gray-50">
            {transactions.slice(0, 20).map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <TxnBadge type={txn.type} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-600">{txn.date}</p>
                    {txn.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{txn.notes}</p>}
                  </div>
                </div>
                <p className={`text-sm font-bold flex-shrink-0 ml-2 ${txn.type === 'in' ? 'text-emerald-600' : txn.type === 'out' ? 'text-red-500' : 'text-blue-600'}`}>
                  {txn.type === 'in' ? '+' : txn.type === 'out' ? '-' : '±'}{Math.abs(txn.quantity)} {item.unitOfMeasurement}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
