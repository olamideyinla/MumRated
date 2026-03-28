import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { useCurrency } from '../../shared/hooks/useCurrency'
import { db } from '../../core/database/db'
import { nowIso } from '../../shared/types/base'
import type { FinancialCategory, FinancialTransaction, Contact } from '../../shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<FinancialCategory, string> = {
  feed: 'Feed', labor: 'Labor', medication: 'Medication', transport: 'Transport',
  utilities: 'Utilities', sales_eggs: 'Egg Sales', sales_birds: 'Bird Sales',
  sales_milk: 'Milk Sales', sales_fish: 'Fish Sales', sales_crops: 'Crop Sales',
  sales_other: 'Other Sales', rent: 'Rent', insurance: 'Insurance',
  equipment: 'Equipment', administrative: 'Admin', other: 'Other',
}

type AgeGroup = 'current' | '30_60' | '60_90' | '90plus'

function getAgeGroup(days: number): AgeGroup {
  if (days <= 30) return 'current'
  if (days <= 60) return '30_60'
  if (days <= 90) return '60_90'
  return '90plus'
}

const AGE_BADGE: Record<AgeGroup, string> = {
  current:  'bg-emerald-100 text-emerald-700',
  '30_60':  'bg-yellow-100 text-yellow-700',
  '60_90':  'bg-orange-100 text-orange-700',
  '90plus': 'bg-red-100 text-red-700',
}
const AGE_LABEL: Record<AgeGroup, string> = {
  current:  '≤30 days',
  '30_60':  '30-60 days',
  '60_90':  '60-90 days',
  '90plus': '90+ days',
}

// ── Components ────────────────────────────────────────────────────────────────

function AgeChip({ group, count, total, fmt }: { group: AgeGroup; count: number; total: number; fmt: (n: number) => string }) {
  const isOverdue = group === '90plus'
  return (
    <div className={`rounded-xl px-3 py-2 text-center shrink-0 border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
      <p className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
        {AGE_LABEL[group]}
      </p>
      <p className={`text-sm font-bold mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
        {fmt(total)}
      </p>
      <p className="text-xs text-gray-400">{count} txn{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AccountsReceivable() {
  const navigate = useNavigate()
  const userId   = useAuthStore(s => s.user?.id)
  const addToast = useUIStore(s => s.addToast)
  const { fmt }  = useCurrency()

  const data = useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null

    const creditTxns = await db.financialTransactions
      .where('organizationId').equals(user.organizationId)
      .filter(t => t.type === 'income' && t.paymentMethod === 'credit')
      .toArray()

    creditTxns.sort((a, b) => a.date.localeCompare(b.date)) // oldest first

    const contactIds = [...new Set(
      creditTxns.map(t => t.counterpartyId).filter((id): id is string => Boolean(id)),
    )]
    const contacts = contactIds.length
      ? await db.contacts.where('id').anyOf(contactIds).toArray()
      : []
    const contactMap = new Map<string, Contact>(contacts.map(c => [c.id, c]))

    return { txns: creditTxns, contactMap }
  }, [userId])

  const today   = useMemo(() => new Date(), [])
  const enriched = useMemo(() => {
    if (!data) return []
    return data.txns.map(txn => ({
      txn,
      daysOld:    differenceInDays(today, parseISO(txn.date)),
      buyerName:  txn.counterpartyId ? (data.contactMap.get(txn.counterpartyId)?.name ?? 'Unknown Buyer') : 'Unknown Buyer',
    }))
  }, [data, today])

  const totalReceivable = enriched.reduce((s, e) => s + e.txn.amount, 0)

  const ageGroups = useMemo(() => {
    const g: Record<AgeGroup, { count: number; total: number }> = {
      current: { count: 0, total: 0 }, '30_60': { count: 0, total: 0 },
      '60_90': { count: 0, total: 0 }, '90plus': { count: 0, total: 0 },
    }
    for (const { txn, daysOld } of enriched) {
      const ag = getAgeGroup(daysOld)
      g[ag].count += 1
      g[ag].total += txn.amount
    }
    return g
  }, [enriched])

  async function handleMarkPaid(id: string) {
    await db.financialTransactions.update(id, {
      paymentMethod: 'cash', updatedAt: nowIso(), syncStatus: 'pending',
    })
    addToast({ message: 'Payment recorded', type: 'success' })
  }

  return (
    <div className="min-h-dvh bg-gray-50 fade-in">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-3 flex items-center gap-3 safe-top">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 active:scale-95 transition-transform flex-shrink-0">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="text-white font-semibold">Accounts Receivable</p>
          <p className="text-white/70 text-xs">Outstanding credit sales</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Total */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total Outstanding</p>
          <p className={`text-2xl font-bold mt-1 ${totalReceivable > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {fmt(totalReceivable)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {enriched.length} credit transaction{enriched.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Age analysis */}
        {enriched.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Age Analysis</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mt-2">
              {(['current', '30_60', '60_90', '90plus'] as AgeGroup[]).map(g => (
                <AgeChip key={g} group={g} count={ageGroups[g].count} total={ageGroups[g].total} fmt={fmt} />
              ))}
            </div>
          </>
        )}

        {/* List */}
        {enriched.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center py-12">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm font-semibold text-gray-700">No outstanding receivables</p>
            <p className="text-xs text-gray-400 mt-1">All credit sales have been collected</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {enriched.map(({ txn, daysOld, buyerName }) => {
              const ag = getAgeGroup(daysOld)
              return (
                <div key={txn.id} className="py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{buyerName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGE_BADGE[ag]}`}>
                          {AGE_LABEL[ag]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {CATEGORY_LABEL[txn.category as FinancialCategory] ?? txn.category}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(txn.date), 'd MMM yyyy')} ·{' '}
                        <span className={ag === '90plus' ? 'text-red-500 font-medium' : ''}>
                          {daysOld} days ago
                        </span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-red-500">{fmt(txn.amount)}</p>
                      <button
                        onClick={() => handleMarkPaid(txn.id)}
                        className="mt-1 text-xs bg-emerald-600 text-white rounded-lg px-2.5 py-1 active:scale-95 transition-transform"
                      >
                        Mark Paid
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
