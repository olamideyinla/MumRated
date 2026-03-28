import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { ArrowLeft, Camera } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import { useCurrency } from '../../../shared/hooks/useCurrency'
import { db } from '../../../core/database/db'
import { newId, nowIso } from '../../../shared/types/base'
import type { FinancialCategory, PaymentMethod } from '../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  date:          string
  category:      FinancialCategory
  description:   string
  amount:        string
  enterpriseId:  string
  payeeName:     string
  paymentMethod: PaymentMethod
  reference:     string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: { value: FinancialCategory; label: string }[] = [
  { value: 'feed',           label: '🌾 Feed'        },
  { value: 'labor',          label: '👷 Labor'       },
  { value: 'medication',     label: '💊 Medication'  },
  { value: 'transport',      label: '🚛 Transport'   },
  { value: 'utilities',      label: '⚡ Utilities'   },
  { value: 'rent',           label: '🏠 Rent'        },
  { value: 'insurance',      label: '🛡️ Insurance'  },
  { value: 'equipment',      label: '🔧 Equipment'   },
  { value: 'administrative', label: '📋 Admin'       },
  { value: 'other',          label: '📌 Other'       },
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',         label: 'Cash'         },
  { value: 'bank',         label: 'Bank'         },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'credit',       label: 'Credit'       },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecordExpenseForm() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const userId         = useAuthStore(s => s.user?.id)
  const addToast       = useUIStore(s => s.addToast)
  const { currency }   = useCurrency()

  const { register, handleSubmit, watch, control, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      defaultValues: {
        date:          format(new Date(), 'yyyy-MM-dd'),
        category:      'feed',
        description:   '',
        amount:        '',
        enterpriseId:  params.get('enterpriseId') ?? '',
        payeeName:     '',
        paymentMethod: 'cash',
        reference:     '',
      },
    })

  const activeEnterprises = useLiveQuery(
    () => db.enterpriseInstances.where('status').equals('active').toArray(), [],
  ) ?? []

  const supplierContacts = useLiveQuery(async () => {
    const all = await db.contacts.toArray()
    return all.filter(c => ['supplier', 'employee', 'transporter'].includes(c.type))
  }, []) ?? []

  const [payeeFocused,   setPayeeFocused]   = useState(false)
  const [receiptName,    setReceiptName]    = useState<string | null>(null)

  const watchedPayeeName = watch('payeeName')

  const payeeSuggestions = supplierContacts.filter(c =>
    watchedPayeeName.length > 0 && c.name.toLowerCase().includes(watchedPayeeName.toLowerCase()),
  )

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptName(file.name)
      setValue('reference', file.name)
    }
  }

  async function onSubmit(values: FormValues) {
    if (!userId) return
    const user = await db.appUsers.get(userId)
    if (!user) return
    const matched = supplierContacts.find(c => c.name.toLowerCase() === values.payeeName.toLowerCase())

    await db.financialTransactions.add({
      id:                   newId(),
      organizationId:       user.organizationId,
      enterpriseInstanceId: values.enterpriseId || undefined,
      date:                 values.date,
      type:                 'expense',
      category:             values.category,
      amount:               parseFloat(values.amount) || 0,
      paymentMethod:        values.paymentMethod,
      counterpartyId:       matched?.id,
      reference:            values.reference || undefined,
      notes:                values.description || (values.payeeName && !matched ? values.payeeName : undefined),
      createdAt:            nowIso(),
      updatedAt:            nowIso(),
      syncStatus:           'pending',
    })

    addToast({ message: 'Expense recorded', type: 'success' })
    navigate(-1)
  }

  return (
    <div className="min-h-dvh bg-gray-50 fade-in">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-3 flex items-center gap-3 safe-top">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 active:scale-95 transition-transform flex-shrink-0">
          <ArrowLeft size={22} />
        </button>
        <p className="text-white font-semibold">Record Expense</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4 pb-10">
        {/* Date / Category / Description */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Date *</label>
            <input type="date" {...register('date', { required: true })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Category *</label>
            <select {...register('category', { required: true })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description</label>
            <input type="text" placeholder="Details about this expense" {...register('description')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
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
        </div>

        {/* Enterprise + Payee */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Enterprise (optional)</label>
            <select {...register('enterpriseId')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
              <option value="">Farm / General</option>
              {activeEnterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Payee / Supplier</label>
            <input type="text" placeholder="Supplier or payee (optional)" autoComplete="off"
              {...register('payeeName')}
              onFocus={() => setPayeeFocused(true)}
              onBlur={() => setTimeout(() => setPayeeFocused(false), 150)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            {payeeFocused && payeeSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                {payeeSuggestions.slice(0, 5).map(c => (
                  <button key={c.id} type="button" onClick={() => setValue('payeeName', c.name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    {c.name}
                    <span className="text-xs text-gray-400 ml-2 capitalize">{c.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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
        </div>

        {/* Reference + Receipt */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Reference</label>
            <input type="text" placeholder="Invoice / receipt number (optional)" {...register('reference')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Receipt Photo</label>
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <Camera size={18} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500 truncate">
                {receiptName ?? 'Take photo or choose file'}
              </span>
              <input type="file" accept="image/*" capture="environment" className="sr-only"
                onChange={handleReceiptChange} />
            </label>
            {receiptName && (
              <p className="text-xs text-emerald-600 mt-1.5">Receipt attached: {receiptName}</p>
            )}
          </div>
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60">
          {isSubmitting ? 'Saving…' : 'Record Expense'}
        </button>
      </form>
    </div>
  )
}
