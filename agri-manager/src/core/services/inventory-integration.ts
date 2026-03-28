/**
 * inventory-integration.ts
 *
 * Called after daily entry saves to keep produce inventory and enterprise
 * stock counts in sync.  Every function is non-throwing — callers should
 * use `.catch(console.error)` so a sync hiccup never blocks the daily save.
 *
 * Two distinct patterns:
 *  • CUMULATIVE produce (eggs, milk): stock-in transactions accumulate over time.
 *  • BALANCE headcount (hens, broilers, fish, cattle, pigs, rabbits, custom):
 *    currentStock is always overwritten with the live count; a dated inventory
 *    transaction is created/updated so mortality reductions appear in Movements.
 */

import { db } from '../database/db'
import { newId, nowIso } from '../../shared/types/base'

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find a produce inventory item by org + name (case-insensitive), or create
 * one with the given unit of measurement.
 */
async function findOrCreateProduceItem(
  orgId: string,
  name: string,
  unit: string,
): Promise<string> {
  const lower = name.toLowerCase()
  const existing = await db.inventoryItems
    .where('organizationId').equals(orgId)
    .filter(i => i.category === 'produce' && i.name.toLowerCase() === lower)
    .first()
  if (existing) return existing.id

  const id  = newId()
  const now = nowIso()
  await db.inventoryItems.add({
    id, organizationId: orgId,
    category: 'produce', name, unitOfMeasurement: unit,
    currentStock: 0,
    syncStatus: 'pending', createdAt: now, updatedAt: now,
  })
  return id
}

/**
 * Stable reference key stamped onto every daily-entry inventory transaction.
 * Guarantees at-most-one transaction per produce item × enterprise × date.
 */
function dailyRef(enterpriseId: string, date: string): string {
  return `daily:${enterpriseId}:${date}`
}

/** Reference key for a per-enterprise headcount-change transaction. */
function headcountRef(enterpriseId: string, date: string): string {
  return `headcount:${enterpriseId}:${date}`
}

/**
 * Insert or update a single daily "stock in" transaction for a produce item.
 * Pass quantity=0 to remove a previously recorded entry (e.g. milk field cleared).
 */
async function upsertDailyStockIn(opts: {
  itemId: string
  enterpriseId: string
  date: string
  quantity: number
  userId: string
  notes: string
}): Promise<void> {
  const { itemId, enterpriseId, date, quantity, userId, notes } = opts
  const ref = dailyRef(enterpriseId, date)
  const now = nowIso()

  const existing = await db.inventoryTransactions
    .where('inventoryItemId').equals(itemId)
    .filter(t => t.reference === ref && t.enterpriseInstanceId === enterpriseId)
    .first()

  const item = await db.inventoryItems.get(itemId)
  if (!item) return

  if (existing) {
    if (quantity === 0) {
      await db.inventoryTransactions.delete(existing.id)
      await db.inventoryItems.update(itemId, {
        currentStock: Math.max(0, item.currentStock - existing.quantity),
        updatedAt: now, syncStatus: 'pending',
      })
    } else {
      const delta = quantity - existing.quantity
      await db.inventoryTransactions.update(existing.id, {
        quantity, notes, updatedAt: now, syncStatus: 'pending',
      })
      if (delta !== 0) {
        await db.inventoryItems.update(itemId, {
          currentStock: Math.max(0, item.currentStock + delta),
          updatedAt: now, syncStatus: 'pending',
        })
      }
    }
  } else if (quantity > 0) {
    await db.inventoryTransactions.add({
      id: newId(), inventoryItemId: itemId,
      type: 'in', quantity,
      enterpriseInstanceId: enterpriseId,
      reference: ref, date, recordedBy: userId,
      notes,
      syncStatus: 'pending', createdAt: now, updatedAt: now,
    })
    await db.inventoryItems.update(itemId, {
      currentStock: item.currentStock + quantity,
      updatedAt: now, syncStatus: 'pending',
    })
  }
}

/**
 * Apply a net change to enterpriseInstances.currentStockCount.
 * Positive delta = stock grows (births), negative = stock shrinks (deaths).
 */
async function applyStockDelta(
  enterpriseId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return
  const ent = await db.enterpriseInstances.get(enterpriseId)
  if (!ent) return
  await db.enterpriseInstances.update(enterpriseId, {
    currentStockCount: Math.max(0, ent.currentStockCount + delta),
    updatedAt: nowIso(), syncStatus: 'pending',
  })
}

/**
 * Sync a per-enterprise balance inventory item for live animals.
 *
 * • currentStock is always SET to the enterprise's currentStockCount (balance, not accumulation).
 * • A dated inventory transaction is created or updated so count reductions
 *   (mortality) and increases (births/restocking) appear in the Movements tab.
 *   The transaction is keyed by `headcount:<enterpriseId>:<date>` so re-saves
 *   are idempotent: it updates the same record rather than stacking duplicates.
 */
async function syncAnimalHeadcountItem(
  orgId: string,
  enterpriseId: string,
  enterpriseName: string,
  unit: string,
  date: string,
  userId: string,
): Promise<void> {
  const ent = await db.enterpriseInstances.get(enterpriseId)
  if (!ent) return

  const lower = enterpriseName.toLowerCase()
  const item = await db.inventoryItems
    .where('organizationId').equals(orgId)
    .filter(i => i.category === 'produce' && i.name.toLowerCase() === lower && i.unitOfMeasurement === unit)
    .first()

  const now      = nowIso()
  const newCount = ent.currentStockCount
  const ref      = headcountRef(enterpriseId, date)

  if (item) {
    // Find today's existing headcount transaction (if the user re-saved)
    const existingTxn = await db.inventoryTransactions
      .where('inventoryItemId').equals(item.id)
      .filter(t => t.reference === ref)
      .first()

    // Reconstruct the "pre-today" base stock so we can compute the true daily delta
    const baseStock = existingTxn
      ? (existingTxn.type === 'out'
          ? item.currentStock + existingTxn.quantity   // reverse previous out
          : item.currentStock - existingTxn.quantity)  // reverse previous in
      : item.currentStock

    const totalDelta = newCount - baseStock   // negative = mortality, positive = additions

    if (existingTxn) {
      if (totalDelta === 0) {
        // Entry edited back to no net change — clean up the transaction
        await db.inventoryTransactions.delete(existingTxn.id)
      } else {
        await db.inventoryTransactions.update(existingTxn.id, {
          type:     totalDelta < 0 ? 'out' : 'in',
          quantity: Math.abs(totalDelta),
          notes:    totalDelta < 0
            ? `Mortality — ${enterpriseName}`
            : `Additions — ${enterpriseName}`,
          updatedAt: now, syncStatus: 'pending',
        })
      }
    } else if (totalDelta !== 0) {
      await db.inventoryTransactions.add({
        id:                   newId(),
        inventoryItemId:      item.id,
        type:                 totalDelta < 0 ? 'out' : 'in',
        quantity:             Math.abs(totalDelta),
        enterpriseInstanceId: enterpriseId,
        reference:            ref,
        date,
        recordedBy:           userId,
        notes:                totalDelta < 0
          ? `Mortality — ${enterpriseName}`
          : `Additions — ${enterpriseName}`,
        syncStatus: 'pending', createdAt: now, updatedAt: now,
      })
    }

    // Always overwrite the balance
    await db.inventoryItems.update(item.id, {
      currentStock: newCount,
      updatedAt: now, syncStatus: 'pending',
    })
  } else {
    // First-ever sync for this enterprise — create the item at current count.
    // No opening transaction: the initial stock comes from the enterprise setup.
    await db.inventoryItems.add({
      id: newId(), organizationId: orgId,
      category: 'produce', name: enterpriseName, unitOfMeasurement: unit,
      currentStock: newCount,
      syncStatus: 'pending', createdAt: now, updatedAt: now,
    })
  }
}

/**
 * Generic animal stock count sync — fish, pig, rabbit, custom_animal.
 */
async function applyGenericStockDelta(opts: {
  enterpriseId: string
  mortalityCount: number
  births: number
  headCountChange: number
  prevMortality: number
  prevBirths: number
  prevHeadCountChange: number
}): Promise<void> {
  const { enterpriseId, mortalityCount, births, headCountChange, prevMortality, prevBirths, prevHeadCountChange } = opts
  const prevNet = prevBirths + prevHeadCountChange - prevMortality
  const newNet  = births + headCountChange - mortalityCount
  await applyStockDelta(enterpriseId, newNet - prevNet)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Layer daily entry → egg produce inventory (cumulative) + hen headcount balance.
 */
export async function syncLayerInventory(opts: {
  orgId: string
  enterpriseId: string
  enterpriseName: string
  date: string
  totalEggs: number
  mortalityCount: number
  prevMortality: number
  userId: string
}): Promise<void> {
  const {
    orgId, enterpriseId, enterpriseName,
    date, totalEggs, mortalityCount, prevMortality, userId,
  } = opts

  // 1. Eggs → cumulative produce inventory
  const eggItemId = await findOrCreateProduceItem(orgId, 'Eggs', 'eggs')
  await upsertDailyStockIn({
    itemId: eggItemId, enterpriseId, date, quantity: totalEggs, userId,
    notes: `Eggs collected — ${enterpriseName}`,
  })

  // 2. Mortality → enterprise hen count delta
  await applyStockDelta(enterpriseId, -(mortalityCount - prevMortality))

  // 3. Hen headcount → balance inventory + mortality transaction
  await syncAnimalHeadcountItem(orgId, enterpriseId, enterpriseName, 'hens', date, userId)
}

/**
 * Broiler daily entry → live bird headcount balance + mortality transaction.
 */
export async function syncBroilerInventory(opts: {
  orgId: string
  enterpriseId: string
  enterpriseName: string
  date: string
  mortalityCount: number
  prevMortality: number
  userId: string
}): Promise<void> {
  const { orgId, enterpriseId, enterpriseName, date, mortalityCount, prevMortality, userId } = opts
  await applyStockDelta(enterpriseId, -(mortalityCount - prevMortality))
  await syncAnimalHeadcountItem(orgId, enterpriseId, enterpriseName, 'birds', date, userId)
}

/**
 * Cattle daily entry → milk produce inventory (cumulative, dairy only)
 *                    + cattle headcount balance + mortality/birth transaction.
 */
export async function syncCattleInventory(opts: {
  orgId: string
  enterpriseId: string
  enterpriseName: string
  date: string
  isDairy: boolean
  milkLiters: number
  deaths: number
  births: number
  prevMilk: number
  prevDeaths: number
  prevBirths: number
  userId: string
}): Promise<void> {
  const {
    orgId, enterpriseId, enterpriseName, date, isDairy,
    milkLiters, deaths, births,
    prevMilk, prevDeaths, prevBirths, userId,
  } = opts

  // 1. Milk → cumulative produce inventory (dairy only)
  if (isDairy && (milkLiters > 0 || prevMilk > 0)) {
    const milkItemId = await findOrCreateProduceItem(orgId, 'Milk', 'litres')
    await upsertDailyStockIn({
      itemId: milkItemId, enterpriseId, date, quantity: milkLiters, userId,
      notes: `Milk collected — ${enterpriseName}`,
    })
  }

  // 2. Deaths / births → enterprise herd count delta
  const prevNet = prevBirths - prevDeaths
  const newNet  = births - deaths
  await applyStockDelta(enterpriseId, newNet - prevNet)

  // 3. Cattle headcount → balance inventory + mortality/birth transaction
  await syncAnimalHeadcountItem(orgId, enterpriseId, enterpriseName, 'heads', date, userId)
}

/**
 * Fish / pig / rabbit / custom_animal → headcount balance + mortality transaction.
 *
 * @param unit  'fish' | 'pigs' | 'rabbits' | 'animals' (or breedOrVariety for custom)
 */
export async function syncGenericAnimalInventory(opts: {
  orgId: string
  enterpriseId: string
  enterpriseName: string
  unit: string
  date: string
  mortalityCount: number
  births: number
  headCountChange: number
  userId: string
  prevMortality: number
  prevBirths: number
  prevHeadCountChange: number
}): Promise<void> {
  const { orgId, enterpriseId, enterpriseName, unit, date, userId } = opts
  await applyGenericStockDelta(opts)
  await syncAnimalHeadcountItem(orgId, enterpriseId, enterpriseName, unit, date, userId)
}
