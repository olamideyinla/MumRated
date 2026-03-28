import type { BaseEntity } from './base'

export type InventoryCategory =
  | 'feed'
  | 'medication'
  | 'fertilizer'
  | 'seed'
  | 'chemical'
  | 'fuel'
  | 'packaging'
  | 'produce'
  | 'other'

export interface InventoryItem extends BaseEntity {
  organizationId: string
  category: InventoryCategory
  name: string
  unitOfMeasurement: string
  currentStock: number
  reorderPoint?: number
  reorderQuantity?: number
}

export interface InventoryTransaction extends BaseEntity {
  inventoryItemId: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  unitCost?: number
  enterpriseInstanceId?: string
  supplierId?: string
  batchOrLotNumber?: string
  expiryDate?: string  // YYYY-MM-DD
  reference?: string
  date: string         // YYYY-MM-DD
  recordedBy: string
  notes?: string
}
