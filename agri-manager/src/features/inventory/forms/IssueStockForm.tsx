// src/features/inventory/forms/IssueStockForm.tsx
import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import { newId, nowIso } from '../../../shared/types'

interface FormValues {
  itemId:               string
  itemSearch:           string
  quantity:             string
  enterpriseInstanceId: string
  date:                 string
  notes:                string
}

export default function IssueStockForm() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const presetItemId   = params.get('itemId') ?? ''
  const userId         = useAuthStore(s => s.user?.id)
  const addToast       = useUIStore(s => s.addToast)
  const [isSaving,     setIsSaving]     = useState(false)
  const [showItemSugg, setShowItemSugg] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      itemId: presetItemId, itemSearch: '', quantity: '',
      enterpriseInstanceId: '', date: today, notes: '',
    },
  })

  const liveData = useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null
    const [items, enterprises] = await Promise.all([
      db.inventoryItems.where('organizationId').equals(user.organizationId).sortBy('name'),
      db.enterpriseInstances.where('status').equals('active').toArray(),
    ])
    return { items, enterprises }
  }, [userId])

  const presetItem = useLiveQuery(
    () => (presetItemId ? db.inventoryItems.get(presetItemId) : undefined),
    [presetItemId],
  )

  const selectedItemId = watch('itemId') || presetItemId
  const itemSearch     = watch('itemSearch')
  const qty            = parseFloat(watch('quantity')) || 0

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

  const wouldGoNegative = selectedItem != null && qty > 0 && qty > selectedItem.currentStock
  const newStockLevel   = selectedItem != null ? selectedItem.currentStock - qty : null

  const onSubmit = async (values: FormValues) => {
    const itemId = presetItemId || values.itemId
    if (!itemId || !userId) { addToast({ message: 'Select an item first', type: 'error' }); return }
    if (qty <= 0) { addToast({ message: 'Quantity must be positive', type: 'error' }); return }

    const item = await db.inventoryItems.get(itemId)
    if (!item) { addToast({ message: 'Item not found', type: 'error' }); return }

    setIsSaving(true)
    try {
      const now = nowIso()

      await db.inventoryTransactions.add({
        id: newId(), inventoryItemId: itemId, type: 'out', quantity: qty,
        enterpriseInstanceId: values.enterpriseInstanceId || undefined,
        date: values.date, recordedBy: userId,
        notes: values.notes || undefined,
        syncStatus: 'pending', createdAt: now, updatedAt: now,
      })

      await db.inventoryItems.update(itemId, {
        currentStock: item.currentStock - qty, updatedAt: now, syncStatus: 'pending',
      })

      addToast({
        message: wouldGoNegative ? 'Stock issued (balance is now negative)' : 'Stock issued',
        type: wouldGoNegative ? 'warning' : 'success',
      })
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
          <h1 className="text-base font-bold text-gray-900">Issue Stock</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Item */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Item</h2>
          {presetItemId && presetItem ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-gray-800">{presetItem.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{presetItem.currentStock} {presetItem.unitOfMeasurement} available</p>
            </div>
          ) : (
            <div className="relative">
              <input {...register('itemSearch')} placeholder="Search items..." autoComplete="off" className="input-base"
                onFocus={() => setShowItemSugg(true)}
                onBlur={() => setTimeout(() => setShowItemSugg(false), 150)} />
              {showItemSugg && filteredItems.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {filteredItems.map(item => (
                    <button key={item.id} type="button"
                      onMouseDown={() => { setValue('itemId', item.id); setValue('itemSearch', item.name); setShowItemSugg(false) }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.currentStock} {item.unitOfMeasurement} available</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedItem && (
                <p className="mt-1 text-xs text-primary-600 font-medium">
                  Available: {selectedItem.currentStock} {selectedItem.unitOfMeasurement}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Quantity</h2>
          <input {...register('quantity', { required: true, min: 0.001 })} type="number" step="any" min="0"
            placeholder="0" className={`input-base ${errors.quantity ? 'border-red-400' : ''}`} />
          {errors.quantity && <p className="text-xs text-red-500">Required, must be positive</p>}
          {selectedItem && qty > 0 && (
            <p className="text-xs text-gray-500">
              Available: {selectedItem.currentStock} {selectedItem.unitOfMeasurement}
            </p>
          )}
          {wouldGoNegative && newStockLevel != null && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This will bring stock to{' '}
                <span className="font-bold">{newStockLevel.toFixed(2)} {selectedItem?.unitOfMeasurement}</span>
                {' '}(negative). Proceed with caution.
              </p>
            </div>
          )}
        </div>

        {/* Enterprise */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Charge to Enterprise (optional)</h2>
          <select {...register('enterpriseInstanceId')} className="input-base">
            <option value="">— None / General —</option>
            {liveData?.enterprises.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* Date & Notes */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Details</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date *</label>
            <input {...register('date', { required: true })} type="date" className="input-base" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea {...register('notes')} rows={2} placeholder="Reason or notes..." className="input-base resize-none" />
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn-primary w-full py-4 text-base">
          {isSaving ? 'Saving...' : 'Issue Stock'}
        </button>
      </form>
    </div>
  )
}
