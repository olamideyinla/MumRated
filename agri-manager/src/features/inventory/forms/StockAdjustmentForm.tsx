// src/features/inventory/forms/StockAdjustmentForm.tsx
import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import { newId, nowIso } from '../../../shared/types'

type AdjustReason = 'shrinkage' | 'damage' | 'count_error' | 'other'

const REASON_LABELS: Record<AdjustReason, string> = {
  shrinkage:   'Shrinkage / Loss',
  damage:      'Damage',
  count_error: 'Count Error',
  other:       'Other Reason',
}

interface FormValues {
  itemId:        string
  itemSearch:    string
  physicalCount: string
  reason:        AdjustReason
  notes:         string
}

export default function StockAdjustmentForm() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const presetItemId   = params.get('itemId') ?? ''
  const userId         = useAuthStore(s => s.user?.id)
  const addToast       = useUIStore(s => s.addToast)
  const [isSaving,     setIsSaving]     = useState(false)
  const [showItemSugg, setShowItemSugg] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      itemId: presetItemId, itemSearch: '', physicalCount: '',
      reason: 'count_error', notes: '',
    },
  })

  const liveData = useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null
    const items = await db.inventoryItems.where('organizationId').equals(user.organizationId).sortBy('name')
    return { items }
  }, [userId])

  const presetItem = useLiveQuery(
    () => (presetItemId ? db.inventoryItems.get(presetItemId) : undefined),
    [presetItemId],
  )

  const selectedItemId   = watch('itemId') || presetItemId
  const itemSearch       = watch('itemSearch')
  const physicalCountRaw = watch('physicalCount')

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

  const physicalCount = physicalCountRaw !== '' ? parseFloat(physicalCountRaw) : null
  const bookQty       = selectedItem?.currentStock ?? null
  const difference    = physicalCount != null && bookQty != null ? physicalCount - bookQty : null

  const onSubmit = async (values: FormValues) => {
    const itemId = presetItemId || values.itemId
    if (!itemId || !userId) { addToast({ message: 'Select an item first', type: 'error' }); return }
    if (values.physicalCount === '' || isNaN(parseFloat(values.physicalCount))) {
      addToast({ message: 'Enter the physical count', type: 'error' }); return
    }

    const item = await db.inventoryItems.get(itemId)
    if (!item) { addToast({ message: 'Item not found', type: 'error' }); return }

    const countVal    = parseFloat(values.physicalCount)
    const diff        = countVal - item.currentStock
    const reasonLabel = REASON_LABELS[values.reason]
    const notesText   = values.notes ? `${reasonLabel}: ${values.notes}` : reasonLabel

    setIsSaving(true)
    try {
      const now   = nowIso()
      const today = new Date().toISOString().split('T')[0]

      await db.inventoryTransactions.add({
        id: newId(), inventoryItemId: itemId, type: 'adjustment', quantity: diff,
        date: today, recordedBy: userId, notes: notesText,
        syncStatus: 'pending', createdAt: now, updatedAt: now,
      })

      await db.inventoryItems.update(itemId, {
        currentStock: countVal, updatedAt: now, syncStatus: 'pending',
      })

      addToast({ message: 'Stock adjusted', type: 'success' })
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
          <h1 className="text-base font-bold text-gray-900">Stock Adjustment</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Item */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Item</h2>
          {presetItemId && presetItem ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-gray-800">{presetItem.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Book quantity: {presetItem.currentStock} {presetItem.unitOfMeasurement}
              </p>
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
                      <p className="text-xs text-gray-400">Book qty: {item.currentStock} {item.unitOfMeasurement}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Physical count */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Physical Count</h2>

          {selectedItem && (
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-500">Book quantity</span>
              <span className="text-sm font-bold text-gray-800">
                {selectedItem.currentStock} {selectedItem.unitOfMeasurement}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Physical count{selectedItem ? ` (${selectedItem.unitOfMeasurement})` : ''} *
            </label>
            <input {...register('physicalCount', { required: true })} type="number" step="any" min="0"
              placeholder="Enter actual counted quantity"
              className={`input-base text-lg font-semibold ${errors.physicalCount ? 'border-red-400' : ''}`} />
            {errors.physicalCount && <p className="text-xs text-red-500 mt-1">Physical count is required</p>}
          </div>

          {difference != null && selectedItem && (
            <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl border ${
              difference > 0 ? 'bg-emerald-50 border-emerald-200'
              : difference < 0 ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
            }`}>
              <span className="text-xs font-semibold text-gray-600">Difference</span>
              <span className={`text-sm font-bold ${
                difference > 0 ? 'text-emerald-600'
                : difference < 0 ? 'text-red-600'
                : 'text-gray-500'
              }`}>
                {difference > 0 ? '+' : ''}{difference.toFixed(2)} {selectedItem.unitOfMeasurement}
                {difference === 0 && <span className="text-xs ml-1 font-normal text-gray-400">(no change)</span>}
              </span>
            </div>
          )}
        </div>

        {/* Reason & Notes */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Reason</h2>
          <select {...register('reason')} className="input-base">
            {(Object.keys(REASON_LABELS) as AdjustReason[]).map(r => (
              <option key={r} value={r}>{REASON_LABELS[r]}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea {...register('notes')} rows={2} placeholder="Any additional context..."
              className="input-base resize-none" />
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn-primary w-full py-4 text-base">
          {isSaving ? 'Saving...' : 'Save Adjustment'}
        </button>
      </form>
    </div>
  )
}
