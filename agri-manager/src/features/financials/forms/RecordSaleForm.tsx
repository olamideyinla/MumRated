import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { ArrowLeft, Package } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import { useCurrency } from '../../../shared/hooks/useCurrency'
import { db } from '../../../core/database/db'
import { newId, nowIso } from '../../../shared/types/base'
import type { FinancialCategory, PaymentMethod, EnterpriseType } from '../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  date:              string
  enterpriseId:      string
  category:          FinancialCategory
  amount:            string
  paymentMethod:     PaymentMethod
  buyerName:         string
  reference:         string
  notes:             string
  inventoryItemId:   string
  inventoryQty:      string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES: { value: FinancialCategory; label: string }[] = [
  { value: 'sales_eggs',  label: 'Egg Sales'         },
  { value: 'sales_birds', label: 'Bird Sales'         },
  { value: 'sales_milk',  label: 'Milk Sales'         },
  { value: 'sales_fish',  label: 'Fish Sales'         },
  { value: 'sales_crops', label: 'Crop Sales'         },
  { value: 'sales_other', label: 'Other Product Sale' },
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',         label: 'Cash'         },
  { value: 'bank',         label: 'Bank'         },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'credit',       label: 'Credit'       },
]

const TYPE_DEFAULT_CAT: Partial<Record<EnterpriseType, FinancialCategory>> = {
  layers:         'sales_eggs',
  broilers:       'sales_birds',
  cattle_dairy:   'sales_milk',
  cattle_beef:    'sales_birds',
  fish:           'sales_fish',
  crop_annual:    'sales_crops',
  crop_perennial: 'sales_crops',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecordSaleForm() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const userId         = useAuthStore(s => s.user?.id)
  const addToast       = useUIStore(s => s.addToast)
  const { currency, fmt } = useCurrency()

  const { register, handleSubmit, watch, control, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      defaultValues: {
        date:            format(new Date(), 'yyyy-MM-dd'),
        enterpriseId:    params.get('enterpriseId') ?? '',
        category:        'sales_eggs',
        amount:          '',
        paymentMethod:   'cash',
        buyerName:       '',
        reference:       '',
        notes:           '',
        inventoryItemId: '',
        inventoryQty:    '',
      },
    })

  const activeEnterprises = useLiveQuery(
    () => db.enterpriseInstances.where('status').equals('active').toArray(), [],
  ) ?? []

  const buyerContacts = useLiveQuery(
    () => db.contacts.where('type').equals('buyer').toArray(), [],
  ) ?? []

  const inventoryItems = useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []
    return db.inventoryItems.where('organizationId').equals(user.organizationId).sortBy('name')
  }, [userId]) ?? []

  // Auto-set category when enterprise changes
  const watchedEntId     = watch('enterpriseId')
  const watchedCat       = watch('category')
  const watchedPay       = watch('paymentMethod')
  const watchedBuyer     = watch('buyerName')
  const watchedInvItemId = watch('inventoryItemId')
  const watchedInvQty    = watch('inventoryQty')

  const selectedInvItem = useMemo(
    () => inventoryItems.find(i => i.id === watchedInvItemId) ?? null,
    [inventoryItems, watchedInvItemId],
  )
  const invQtyNum = parseFloat(watchedInvQty) || 0

  useEffect(() => {
    if (!watchedEntId) return
    const ent = activeEnterprises.find(e => e.id === watchedEntId)
    if (!ent) return
    const def = TYPE_DEFAULT_CAT[ent.enterpriseType as EnterpriseType]
    if (def) setValue('category', def)
  }, [watchedEntId, activeEnterprises, setValue])

  // Last sale hint
  const lastSale = useLiveQuery(async () => {
    if (!watchedEntId || !watchedCat) return null
    const all = await db.financialTransactions
      .where('enterpriseInstanceId').equals(watchedEntId)
      .filter(t => t.type === 'income' && t.category === watchedCat)
      .toArray()
    if (!all.length) return null
    return all.sort((a, b) => b.date.localeCompare(a.date))[0]
  }, [watchedEntId, watchedCat])

  const [buyerFocused, setBuyerFocused] = useState(false)
  const buyerSuggestions = buyerContacts.filter(c =>
    watchedBuyer.length > 0 && c.name.toLowerCase().includes(watchedBuyer.toLowerCase()),
  )

  async function onSubmit(values: FormValues) {
    if (!userId) return
    const user = await db.appUsers.get(userId)
    if (!user) return
    const matched = buyerContacts.find(c => c.name.toLowerCase() === values.buyerName.toLowerCase())
    const now = nowIso()

    await db.financialTransactions.add({
      id:                   newId(),
      organizationId:       user.organizationId,
      enterpriseInstanceId: values.enterpriseId || undefined,
      date:                 values.date,
      type:                 'income',
      category:             values.category,
      amount:               parseFloat(values.amount) || 0,
      paymentMethod:        values.paymentMethod,
      counterpartyId:       matched?.id,
      reference:            values.reference || undefined,
      notes:                values.notes || (values.buyerName && !matched ? values.buyerName : undefined),
      createdAt:            now,
      updatedAt:            now,
      syncStatus:           'pending',
    })

    // Deduct from inventory if an item and quantity were provided
    if (values.inventoryItemId && invQtyNum > 0) {
      const item = await db.inventoryItems.get(values.inventoryItemId)
      if (item) {
        await db.inventoryTransactions.add({
          id:                   newId(),
          inventoryItemId:      item.id,
          type:                 'out',
          quantity:             invQtyNum,
          enterpriseInstanceId: values.enterpriseId || undefined,
          date:                 values.date,
          recordedBy:           userId,
          notes:                `Sale: ${values.reference || values.notes || values.category}`,
          createdAt:            now,
          updatedAt:            now,
          syncStatus:           'pending',
        })
        await db.inventoryItems.update(item.id, {
          currentStock: Math.max(0, item.currentStock - invQtyNum),
          updatedAt:    now,
          syncStatus:   'pending',
        })
      }
    }

    addToast({ message: 'Sale recorded', type: 'success' })
    navigate(-1)
  }

  return (
    <div className="min-h-dvh bg-gray-50 fade-in">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-3 flex items-center gap-3 safe-top">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 active:scale-95 transition-transform flex-shrink-0">
          <ArrowLeft size={22} />
        </button>
        <p className="text-white font-semibold">Record Sale</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4 pb-10">
        {/* Date / Enterprise / Category */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Date *</label>
            <input type="date" {...register('date', { required: true })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Enterprise</label>
            <select {...register('enterpriseId')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
              <option value="">Farm / General</option>
              {activeEnterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Product Type *</label>
            <select {...register('category', { required: true })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
              {INCOME_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
            <input type="number" step="0.01" min="0" placeholder="0.00"
              {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be > 0' } })}
              className={`border border-gray-200 rounded-xl pr-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 ${currency.length <= 1 ? 'pl-7' : currency.length <= 2 ? 'pl-9' : 'pl-12'}`} />
          </div>
          {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          {lastSale && (
            <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-400">
                Last sale: <span className="text-emerald-600 font-semibold">{fmt(lastSale.amount)}</span>
                {' '}on {format(new Date(lastSale.date), 'd MMM yyyy')}
              </p>
            </div>
          )}
        </div>

        {/* Inventory deduction */}
        {inventoryItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-gray-400" />
              <label className="text-xs font-semibold text-gray-600">Deduct from Inventory (optional)</label>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Inventory Item</label>
              <select {...register('inventoryItemId')}
                className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                <option value="">— None —</option>
                {inventoryItems.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.currentStock} {i.unitOfMeasurement} in stock)
                  </option>
                ))}
              </select>
            </div>
            {selectedInvItem && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Quantity sold ({selectedInvItem.unitOfMeasurement})
                </label>
                <input type="number" step="any" min="0" placeholder="0"
                  {...register('inventoryQty')}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                {invQtyNum > selectedInvItem.currentStock && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠ Quantity exceeds current stock ({selectedInvItem.currentStock} {selectedInvItem.unitOfMeasurement})
                  </p>
                )}
                {invQtyNum > 0 && invQtyNum <= selectedInvItem.currentStock && (
                  <p className="text-xs text-gray-400 mt-1">
                    Stock after sale: {(selectedInvItem.currentStock - invQtyNum).toLocaleString()} {selectedInvItem.unitOfMeasurement}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment method */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Payment Method</label>
          <Controller control={control} name="paymentMethod" render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.value} type="button" onClick={() => field.onChange(pm.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    field.value === pm.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {pm.label}
                </button>
              ))}
            </div>
          )} />
          {watchedPay === 'credit' && (
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-2.5 py-1.5">
              Credit sales appear in Accounts Receivable until marked paid.
            </p>
          )}
        </div>

        {/* Buyer / Reference / Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Buyer</label>
            <input type="text" placeholder="Buyer name (optional)" autoComplete="off"
              {...register('buyerName')}
              onFocus={() => setBuyerFocused(true)}
              onBlur={() => setTimeout(() => setBuyerFocused(false), 150)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            {buyerFocused && buyerSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                {buyerSuggestions.slice(0, 5).map(c => (
                  <button key={c.id} type="button" onClick={() => setValue('buyerName', c.name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Reference</label>
            <input type="text" placeholder="Invoice number (optional)" {...register('reference')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notes</label>
            <textarea rows={2} placeholder="Additional details (optional)" {...register('notes')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60">
          {isSubmitting ? 'Saving…' : 'Record Sale'}
        </button>
      </form>
    </div>
  )
}
