// src/features/inventory/InventoryPage.tsx
import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ChevronDown, ChevronRight, Package, AlertTriangle, ArrowUpDown, Download } from 'lucide-react'
import { db } from '../../core/database/db'
import { useInventoryItems, useLowStockItems } from '../../core/database/hooks/use-inventory'
import { useAuthStore } from '../../stores/auth-store'
import { exportInventoryReport } from '../../core/services/csv-export'
import type { InventoryCategory, InventoryItem, InventoryTransaction } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  feed: 'Feed', medication: 'Medication', fertilizer: 'Fertilizer',
  seed: 'Seed', chemical: 'Chemical', fuel: 'Fuel',
  packaging: 'Packaging', produce: 'Produce', other: 'Other',
}

const CATEGORY_ORDER: InventoryCategory[] = [
  'produce', 'feed', 'medication', 'fertilizer', 'seed', 'chemical', 'fuel', 'packaging', 'other',
]

type DateFilter = 'all' | 'today' | 'last7' | 'last30'
type TypeFilter = 'all' | 'in' | 'out' | 'adjustment'
type TabId = 'stock' | 'movements' | 'alerts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function daysAgoStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function stockBadge(item: InventoryItem): { label: string; cls: string } {
  if (item.currentStock === 0)
    return { label: 'Out', cls: 'bg-red-100 text-red-700' }
  if (item.reorderPoint != null && item.currentStock <= item.reorderPoint)
    return { label: 'Low', cls: 'bg-red-100 text-red-700' }
  if (item.reorderPoint != null && item.currentStock <= item.reorderPoint * 2)
    return { label: 'Watch', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' }
}

function TxnTypeBadge({ type }: { type: InventoryTransaction['type'] }) {
  if (type === 'in')
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">IN</span>
  if (type === 'out')
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 uppercase">OUT</span>
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">ADJ</span>
}

// ── FAB Action Sheet ──────────────────────────────────────────────────────────

function FabSheet({ onClose, navigate }: {
  onClose: () => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const actions = [
    { label: 'Receive Stock', path: '/inventory/receive'  },
    { label: 'Issue Stock',   path: '/inventory/issue'    },
    { label: 'Adjust Stock',  path: '/inventory/adjust'   },
    { label: 'Add New Item',  path: '/inventory/add-item' },
  ]
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-20 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-52">
        {actions.map(a => (
          <button
            key={a.path}
            onClick={() => { navigate(a.path); onClose() }}
            className="w-full px-4 py-3.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50 last:border-0"
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  )
}

// ── Stock Tab ─────────────────────────────────────────────────────────────────

function StockTab() {
  const navigate = useNavigate()
  const items    = useInventoryItems()
  const userId   = useAuthStore(s => s.user?.id)
  const appUser  = useAuthStore(s => s.appUser)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!appUser) return
    setExporting(true)
    try { await exportInventoryReport(appUser.organizationId) }
    finally { setExporting(false) }
  }

  const recentOutTxns = useLiveQuery(async () => {
    if (!userId) return []
    const cutoff = daysAgoStr(14)
    const all = await db.inventoryTransactions.where('date').aboveOrEqual(cutoff).toArray()
    return all.filter(t => t.type === 'out')
  }, [userId]) ?? []

  const avgConsumptionMap = useMemo(() => {
    const map = new Map<string, number>()
    const totals = new Map<string, number>()
    for (const t of recentOutTxns) {
      totals.set(t.inventoryItemId, (totals.get(t.inventoryItemId) ?? 0) + t.quantity)
    }
    for (const [id, total] of totals) map.set(id, total / 14)
    return map
  }, [recentOutTxns])

  const [collapsed, setCollapsed] = useState<Partial<Record<InventoryCategory, boolean>>>({})
  const toggle = (cat: InventoryCategory) => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))

  if (!items) return <div className="p-4 text-sm text-gray-400">Loading...</div>

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <Package size={40} className="text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-600">No items yet</p>
        <p className="text-xs text-gray-400 mt-1">Tap + to add your first inventory item</p>
      </div>
    )
  }

  const grouped = Object.fromEntries(
    CATEGORY_ORDER.map(cat => [cat, items.filter(i => i.category === cat)])
  ) as Record<InventoryCategory, InventoryItem[]>

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex justify-end pt-1">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1 text-xs text-primary-600 font-medium px-2 py-1.5 rounded-lg active:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {CATEGORY_ORDER.map(cat => {
        const catItems = grouped[cat]
        if (catItems.length === 0) return null
        const isCollapsed = collapsed[cat] ?? false
        return (
          <div key={cat} className="card p-0 overflow-hidden">
            <button
              onClick={() => toggle(cat)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100"
            >
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
                <span className="ml-2 font-normal normal-case text-gray-400">({catItems.length})</span>
              </span>
              {isCollapsed
                ? <ChevronRight size={16} className="text-gray-400" />
                : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {!isCollapsed && (
              <div className="divide-y divide-gray-50">
                {catItems.map(item => {
                  const badge = stockBadge(item)
                  const avg   = avgConsumptionMap.get(item.id)
                  const days  = avg && avg > 0 ? Math.round(item.currentStock / avg) : null
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/inventory/${item.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.currentStock.toLocaleString()} {item.unitOfMeasurement}
                          {days != null
                            ? <span className="ml-1">· ~{days}d remaining</span>
                            : <span className="ml-1 text-gray-300">· — days</span>}
                        </p>
                      </div>
                      <span className={`ml-3 flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Movements Tab ─────────────────────────────────────────────────────────────

function MovementsTab() {
  const [dateFilt, setDateFilt] = useState<DateFilter>('last7')
  const [typeFilt, setTypeFilt] = useState<TypeFilter>('all')
  const userId = useAuthStore(s => s.user?.id)

  const data = useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null

    const orgItems = await db.inventoryItems.where('organizationId').equals(user.organizationId).toArray()
    const itemMap  = new Map(orgItems.map(i => [i.id, i]))
    const itemIds  = new Set(orgItems.map(i => i.id))

    const allTxns = await db.inventoryTransactions.toArray()
    const orgTxns = allTxns.filter(t => itemIds.has(t.inventoryItemId))

    const entIds = [...new Set(
      orgTxns.map(t => t.enterpriseInstanceId).filter((id): id is string => id != null)
    )]
    const enterprises = entIds.length > 0 ? await db.enterpriseInstances.bulkGet(entIds) : []
    const entMap = new Map<string, string>()
    for (const e of enterprises) { if (e) entMap.set(e.id, e.name) }

    return { txns: orgTxns, itemMap, entMap }
  }, [userId])

  const filtered = useMemo(() => {
    if (!data) return []
    const today = todayStr()
    let fromDate = '2000-01-01'
    if (dateFilt === 'today')  fromDate = today
    if (dateFilt === 'last7')  fromDate = daysAgoStr(7)
    if (dateFilt === 'last30') fromDate = daysAgoStr(30)
    return data.txns
      .filter(t => t.date >= fromDate)
      .filter(t => typeFilt === 'all' || t.type === typeFilt)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [data, dateFilt, typeFilt])

  const DATE_CHIPS: Array<{ id: DateFilter; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'today', label: 'Today' },
    { id: 'last7', label: 'Last 7' }, { id: 'last30', label: 'Last 30' },
  ]
  const TYPE_CHIPS: Array<{ id: TypeFilter; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'in', label: 'In' },
    { id: 'out', label: 'Out' }, { id: 'adjustment', label: 'Adj' },
  ]

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  if (!data) return <div className="p-4 text-sm text-gray-400">Loading...</div>

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-1 pb-0.5">
        {DATE_CHIPS.map(c => (
          <button key={c.id} onClick={() => setDateFilt(c.id)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${dateFilt === c.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {TYPE_CHIPS.map(c => (
          <button key={c.id} onClick={() => setTypeFilt(c.id)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${typeFilt === c.id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>
            {c.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card text-center py-10">
          <ArrowUpDown size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No movements found</p>
        </div>
      )}
      {filtered.length > 0 && (
        <div ref={parentRef} className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vItem => {
              const txn     = filtered[vItem.index]
              const item    = data.itemMap.get(txn.inventoryItemId)
              const entName = txn.enterpriseInstanceId ? data.entMap.get(txn.enterpriseInstanceId) : undefined
              return (
                <div
                  key={txn.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  <div className="card p-3 flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <TxnTypeBadge type={txn.type} />
                        <p className="text-xs text-gray-400">{txn.date}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">{item?.name ?? 'Unknown item'}</p>
                      {entName && <p className="text-xs text-primary-600 mt-0.5">{entName}</p>}
                      {txn.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{txn.notes}</p>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-bold ${txn.type === 'in' ? 'text-emerald-600' : txn.type === 'out' ? 'text-red-500' : 'text-blue-600'}`}>
                        {txn.type === 'in' ? '+' : txn.type === 'out' ? '-' : '±'}{Math.abs(txn.quantity)}
                      </p>
                      <p className="text-xs text-gray-400">{item?.unitOfMeasurement ?? ''}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alerts Tab ────────────────────────────────────────────────────────────────

function AlertsTab() {
  const navigate = useNavigate()
  const lowItems = useLowStockItems()

  if (!lowItems) return <div className="p-4 text-sm text-gray-400">Loading...</div>

  if (lowItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <Package size={24} className="text-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700">All stock levels OK</p>
        <p className="text-xs text-gray-400 mt-1">No items are below their reorder point</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">
        {lowItems.length} item{lowItems.length !== 1 ? 's' : ''} need attention
      </p>
      {lowItems.map(item => {
        const isOut = item.currentStock === 0
        return (
          <button key={item.id} onClick={() => navigate(`/inventory/${item.id}`)}
            className="card w-full text-left flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-red-50' : 'bg-amber-50'}`}>
              <AlertTriangle size={18} className={isOut ? 'text-red-500' : 'text-amber-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.currentStock} {item.unitOfMeasurement} remaining
                {item.reorderPoint != null && <span className="ml-1">· reorder at {item.reorderPoint}</span>}
              </p>
            </div>
            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {isOut ? 'Out' : 'Low'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabId>('stock')
  const [fabOpen,   setFabOpen]   = useState(false)
  const navigate  = useNavigate()
  const lowItems  = useLowStockItems()
  const alertCount = lowItems?.length ?? 0

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'stock',     label: 'Stock' },
    { id: 'movements', label: 'Movements' },
    { id: 'alerts',    label: alertCount > 0 ? `Alerts (${alertCount})` : 'Alerts' },
  ]

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track stock levels, movements and reorder points</p>
      </div>
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pt-3 content-with-nav">
        {activeTab === 'stock'     && <StockTab />}
        {activeTab === 'movements' && <MovementsTab />}
        {activeTab === 'alerts'    && <AlertsTab />}
      </div>
      <button onClick={() => setFabOpen(v => !v)}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-primary-700 transition-colors"
        aria-label="Inventory actions">
        <Plus size={24} />
      </button>
      {fabOpen && <FabSheet onClose={() => setFabOpen(false)} navigate={navigate} />}
    </div>
  )
}
