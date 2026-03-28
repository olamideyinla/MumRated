// src/features/inventory/forms/ReceiveStockForm.tsx
import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import { newId, nowIso } from '../../../shared/types'
import type { InventoryCategory, FinancialCategory } from '../../../shared/types'

function toFinancialCategory(cat: InventoryCategory): FinancialCategory {
  if (cat === 'feed')       return 'feed'
  if (cat === 'medication') return 'medication'
  return 'other'
}

interface FormValues {
  itemId:           string
  itemSearch:       string
  quantity:         string
  unitCost:         string
  supplierSearch:   string
  supplierId:       string
  date:             string
  batchOrLotNumber: string
  expiryDate:       string
  notes:            string
}

export default function ReceiveStockForm() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const presetItemId   = params.get('itemId') ?? ''
  const userId         = useAuthStore(s => s.user?.id)
  const addToast       = useUIStore(s => s.addToast)
  const [isSaving,        setIsSaving]        = useState(false)
  const [showItemSugg,    setShowItemSugg]    = useState(false)
  const [showSupplierSugg, setShowSupplierSugg] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      itemId: presetItemId, itemSearch: '', quantity: '', unitCost: '',
      supplierSearch: '', supplierId: '', date: today,
      batchOrLotNumber: '', expiryDate: '', notes: '',
    },
  })

  const liveData = useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null
    const [items, contacts] = await Promise.all([
      db.inventoryItems.where('organizationId').equals(user.organizationId).sortBy('name'),
      db.contacts.where('organizationId').equals(user.organizationId).toArray(),
    ])
    return { items, suppliers: contacts.filter(c => c.type === 'supplier'), organizationId: user.organizationId }
  }, [userId])

  const presetItem = useLiveQuery(
    () => (presetItemId ? db.inventoryItems.get(presetItemId) : undefined),
    [presetItemId],
  )

  const selectedItemId = watch('itemId') || presetItemId
  const itemSearch     = watch('itemSearch')
  const supplierSearch = watch('supplierSearch')
  const qty            = parseFloat(watch('quantity')) || 0
  const unitCost       = parseFloat(watch('unitCost')) || 0

  const selectedItem = useMemo(() => {
    if (presetItemId && presetItem) return presetItem
    return liveData?.items.find(i => i.id === selectedItemId) ?? null
  }, [liveData, selectedItemId, presetItemId, presetItem])

  const filteredItems = useMemo(() => {
    if (!liveData || presetItemId) return []
    if (!itemSearch.trim()) return liveData.items.slice(0, 8)
    const q = itemSearch.toLowerCase()
    return liveData.items.filter(i => i.name.toLowerCase().includes(q) || i.category.includes(q)).slice(0, 8)
  }, [liveData, itemSearch, presetItemId])

  const filteredSuppliers = useMemo(() => {
    if (!liveData) return []
    if (!supplierSearch.trim()) return liveData.suppliers.slice(0, 6)
    const q = supplierSearch.toLowerCase()
    return liveData.suppliers.filter(s => s.name.toLowerCase().includes(q)).slice(0, 6)
  }, [liveData, supplierSearch])

  const onSubmit = async (values: FormValues) => {
    const itemId = presetItemId || values.itemId
    if (!itemId || !userId) { addToast({ message: 'Select an item first', type: 'error' }); return }
    if (qty <= 0) { addToast({ message: 'Quantity must be positive', type: 'error' }); return }

    const item = await db.inventoryItems.get(itemId)
    if (!item) { addToast({ message: 'Item not found', type: 'error' }); return }

    setIsSaving(true)
    try {
      const now         = nowIso()
      const unitCostVal = parseFloat(values.unitCost) || undefined
      const supplierId  = values.supplierId || undefined

      await db.inventoryTransactions.add({
        id: newId(), inventoryItemId: itemId, type: 'in', quantity: qty,
        unitCost: unitCostVal, supplierId,
        batchOrLotNumber: values.batchOrLotNumber || undefined,
        expiryDate:       values.expiryDate || undefined,
        date: values.date, recordedBy: userId,
        notes: values.notes || undefined,
        syncStatus: 'pending', createdAt: now, updatedAt: now,
      })

      await db.inventoryItems.update(itemId, {
        currentStock: item.currentStock + qty, updatedAt: now, syncStatus: 'pending',
      })

      if (unitCostVal && liveData?.organizationId) {
        await db.financialTransactions.add({
          id: newId(), organizationId: liveData.organizationId,
          date: values.date, type: 'expense',
          category: toFinancialCategory(item.category),
          amount: qty * unitCostVal, paymentMethod: 'cash',
          counterpartyId: supplierId,
          notes: `Stock in: ${item.name}`,
          syncStatus: 'pending', createdAt: now, updatedAt: now,
        })
      }

      addToast({ message: 'Stock received', type: 'success' })
      navigate(-1)
    } catch {
      addToast({ message: 'Failed to save — try again', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={() => navigate(-1)} className="touch-target -ml-2 text-gray-600">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-gray-900">Receive Stock</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Item */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Item</h2>
          {presetItemId && presetItem ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-gray-800">{presetItem.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{presetItem.category} · {presetItem.currentStock} {presetItem.unitOfMeasurement} in stock</p>
            </div>
          ) : (
            <div className="relative">
              <input {...register('itemSearch')} placeholder="Search items..."
                autoComplete="off" className="input-base"
                onFocus={() => setShowItemSugg(true)}
                onBlur={() => setTimeout(() => setShowItemSugg(false), 150)} />
              {showItemSugg && filteredItems.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {filteredItems.map(item => (
                    <button key={item.id} type="button"
                      onMouseDown={() => { setValue('itemId', item.id); setValue('itemSearch', item.name); setShowItemSugg(false) }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.category} · {item.currentStock} {item.unitOfMeasurement}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedItem && (
                <p className="mt-1 text-xs text-primary-600 font-medium">
                  Selected: {selectedItem.name} ({selectedItem.currentStock} {selectedItem.unitOfMeasurement} in stock)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quantity & Cost */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Quantity & Cost</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Quantity{selectedItem ? ` (${selectedItem.unitOfMeasurement})` : ''} *
            </label>
            <input {...register('quantity', { required: true, min: 0.001 })} type="number" step="any" min="0"
              placeholder="0" className={`input-base ${errors.quantity ? 'border-red-400' : ''}`} />
            {errors.quantity && <p className="text-xs text-red-500 mt-1">Required, must be positive</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Unit cost{selectedItem ? ` per ${selectedItem.unitOfMeasurement}` : ''} (optional)
            </label>
            <input {...register('unitCost')} type="number" step="any" min="0" placeholder="0.00" className="input-base" />
            {qty > 0 && unitCost > 0 && (
              <p className="mt-1 text-xs text-gray-500 font-medium">
                Total: {(qty * unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>

        {/* Supplier */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Supplier (optional)</h2>
          <div className="relative">
            <input {...register('supplierSearch')} placeholder="Search or type supplier name..."
              autoComplete="off" className="input-base"
              onFocus={() => setShowSupplierSugg(true)}
              onBlur={() => setTimeout(() => setShowSupplierSugg(false), 150)} />
            {showSupplierSugg && filteredSuppliers.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                {filteredSuppliers.map(s => (
                  <button key={s.id} type="button"
                    onMouseDown={() => { setValue('supplierId', s.id); setValue('supplierSearch', s.name); setShowSupplierSugg(false) }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Details</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date *</label>
            <input {...register('date', { required: true })} type="date" className="input-base" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Batch / Lot Number (optional)</label>
            <input {...register('batchOrLotNumber')} placeholder="e.g. LOT-2024-003" className="input-base" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expiry Date (optional)</label>
            <input {...register('expiryDate')} type="date" className="input-base" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea {...register('notes')} rows={2} placeholder="Any additional notes..." className="input-base resize-none" />
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn-primary w-full py-4 text-base">
          {isSaving ? 'Saving...' : 'Receive Stock'}
        </button>
      </form>
    </div>
  )
}
