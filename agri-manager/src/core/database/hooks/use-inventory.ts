import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'
import type { InventoryItem, InventoryTransaction } from '../../../shared/types'

export interface DateRange { from: string; to: string }

// ── useInventoryItems ─────────────────────────────────────────────────────────

/** All inventory items for the current user's organization, live-updating */
export function useInventoryItems(): InventoryItem[] | undefined {
  const userId = useAuthStore(s => s.user?.id)
  return useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []
    return db.inventoryItems
      .where('organizationId').equals(user.organizationId)
      .sortBy('name')
  }, [userId])
}

// ── useLowStockItems ──────────────────────────────────────────────────────────

/** Items where currentStock ≤ reorderPoint */
export function useLowStockItems(): InventoryItem[] | undefined {
  const userId = useAuthStore(s => s.user?.id)
  return useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []
    const items = await db.inventoryItems
      .where('organizationId').equals(user.organizationId).toArray()
    return items
      .filter(item => item.reorderPoint != null && item.currentStock <= item.reorderPoint)
      .sort((a, b) => {
        // Sort by most critical first: out of stock, then by % remaining
        if (a.currentStock === 0 && b.currentStock !== 0) return -1
        if (b.currentStock === 0 && a.currentStock !== 0) return 1
        const aPct = a.reorderPoint ? a.currentStock / a.reorderPoint : 1
        const bPct = b.reorderPoint ? b.currentStock / b.reorderPoint : 1
        return aPct - bPct
      })
  }, [userId])
}

// ── useItemTransactions ───────────────────────────────────────────────────────

/** All transactions for a specific item, optionally filtered by date range */
export function useItemTransactions(
  itemId: string | undefined,
  dateRange?: DateRange,
): InventoryTransaction[] | undefined {
  return useLiveQuery(async () => {
    if (!itemId) return []
    const txns = await db.inventoryTransactions
      .where('inventoryItemId').equals(itemId).toArray()
    const filtered = dateRange
      ? txns.filter(t => t.date >= dateRange.from && t.date <= dateRange.to)
      : txns
    return filtered.sort((a, b) => b.date.localeCompare(a.date))
  }, [itemId, dateRange?.from, dateRange?.to])
}
