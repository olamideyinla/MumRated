import { useState } from 'react'
import { Download } from 'lucide-react'
import { format } from 'date-fns'
import { useRecordsForEnterprise } from '../../../core/database/hooks/use-daily-records'
import { useUIStore } from '../../../stores/ui-store'
import { downloadBlob } from '../../../shared/utils/file-download'
import type { EnterpriseInstance, EnterpriseType } from '../../../shared/types'
import type { AnyDailyRecord } from '../../../core/database/hooks/use-daily-records'

// ── Record summary line ───────────────────────────────────────────────────────

function recordSummary(type: EnterpriseType, record: AnyDailyRecord): string {
  const r = record as any
  switch (type) {
    case 'layers':          return `${r.totalEggs ?? 0} eggs · ${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed`
    case 'broilers':        return `${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed${r.bodyWeightSampleAvg ? ` · ${r.bodyWeightSampleAvg} kg avg` : ''}`
    case 'cattle_dairy':    return `${r.milkYieldLiters ?? 0} L milk · ${r.feedConsumedKg ?? 0} kg feed`
    case 'cattle_beef':     return `${r.deaths ?? 0} deaths · ${r.births ?? 0} births · ${r.feedConsumedKg ?? 0} kg feed`
    case 'fish':            return `${r.feedGivenKg ?? 0} kg feed · ${r.estimatedMortality ?? 0} mort.`
    case 'pigs_breeding':
    case 'pigs_growfinish': return `${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed`
    case 'rabbit':          return `${r.mortalityCount ?? 0} deaths · ${r.feedConsumedKg ?? 0} kg feed`
    case 'custom_animal':   return `${r.mortalityCount ?? 0} mort. · ${r.feedConsumedKg ?? 0} kg feed`
    case 'crop_annual':
    case 'crop_perennial':  return r.activityType?.replace('_', ' ') ?? ''
    default: return ''
  }
}

// ── CSV export ────────────────────────────────────────────────────────────────

function toCSV(records: AnyDailyRecord[], type: EnterpriseType): { csv: string; headers: string[] } {
  if (records.length === 0) return { csv: '', headers: [] }
  const r0 = records[0] as any

  let headers: string[]
  let getRow: (r: any) => (string | number)[]

  switch (type) {
    case 'layers':
      headers = ['Date', 'Total Eggs', 'Broken Eggs', 'Reject Eggs', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Temp High', 'Temp Low', 'Notes']
      getRow = r => [r.date, r.totalEggs, r.brokenEggs ?? '', r.rejectEggs ?? '', r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.temperatureHigh ?? '', r.temperatureLow ?? '', r.notes ?? '']
      break
    case 'broilers':
      headers = ['Date', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Avg Body Weight (kg)', 'Sample Size', 'Notes']
      getRow = r => [r.date, r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.bodyWeightSampleAvg ?? '', r.bodyWeightSampleSize ?? '', r.notes ?? '']
      break
    case 'cattle_dairy':
    case 'cattle_beef':
      headers = ['Date', 'Milk Yield (L)', 'Milkings', 'Feed (kg)', 'Feed Type', 'Deaths', 'Births', 'Health Notes', 'Notes']
      getRow = r => [r.date, r.milkYieldLiters ?? '', r.milkingCount ?? '', r.feedConsumedKg ?? '', r.feedType ?? '', r.deaths ?? '', r.births ?? '', r.healthNotes ?? '', r.notes ?? '']
      break
    case 'fish':
      headers = ['Date', 'Feed (kg)', 'Feed Type', 'Estimated Mortality', 'Water Temp (°C)', 'pH', 'DO (mg/L)', 'Ammonia (mg/L)', 'Notes']
      getRow = r => [r.date, r.feedGivenKg, r.feedType ?? '', r.estimatedMortality ?? '', r.waterTemp ?? '', r.waterPh ?? '', r.dissolvedOxygen ?? '', r.ammonia ?? '', r.notes ?? '']
      break
    case 'pigs_breeding':
    case 'pigs_growfinish':
      headers = ['Date', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Births', 'Weaned', 'Avg Weight (kg)', 'Notes']
      getRow = r => [r.date, r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.birthCount ?? '', r.weanCount ?? '', r.avgBodyWeightSampleKg ?? '', r.notes ?? '']
      break
    case 'rabbit':
      headers = ['Date', 'Mortality', 'Mortality Cause', 'Feed (kg)', 'Feed Type', 'Water (L)', 'Births', 'Weaned', 'Matings', 'Avg Weight (kg)', 'Notes']
      getRow = r => [r.date, r.mortalityCount, r.mortalityCause ?? '', r.feedConsumedKg, r.feedType ?? '', r.waterConsumedLiters ?? '', r.birthCount ?? '', r.weanCount ?? '', r.matingCount ?? '', r.avgBodyWeightSampleKg ?? '', r.notes ?? '']
      break
    case 'crop_annual':
    case 'crop_perennial':
      headers = ['Date', 'Activity Type', 'Input Used', 'Input Qty', 'Input Unit', 'Labor Hours', 'Workers', 'Harvest Qty (kg)', 'Notes']
      getRow = r => [r.date, r.activityType ?? '', r.inputUsed ?? '', r.inputQuantity ?? '', r.inputUnit ?? '', r.laborHours ?? '', r.workerCount ?? '', r.harvestQuantityKg ?? '', r.notes ?? '']
      break
    default:
      headers = Object.keys(r0)
      getRow = r => headers.map(k => r[k] ?? '')
  }

  const rows = records.map(r => getRow(r).map(v => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(','))
  const csv = '\ufeff' + [headers.join(','), ...rows].join('\n')
  return { csv, headers }
}

// ── Date filter chips ─────────────────────────────────────────────────────────

const DATE_FILTERS = [
  { label: 'All', days: 0 },
  { label: 'Last 7', days: 7 },
  { label: 'Last 30', days: 30 },
  { label: 'This Month', days: -1 },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { enterprise: EnterpriseInstance }

export function EnterpriseRecords({ enterprise }: Props) {
  const [filterDays, setFilterDays] = useState(30)
  const addToast = useUIStore(s => s.addToast)

  const today = new Date().toISOString().split('T')[0]
  const from = filterDays === -1
    ? today.slice(0, 7) + '-01'
    : filterDays === 0
      ? '2000-01-01'
      : (() => { const d = new Date(); d.setDate(d.getDate() - filterDays); return d.toISOString().split('T')[0] })()

  const records = useRecordsForEnterprise(enterprise.id, { from, to: today })

  const exportCSV = () => {
    if (!records || records.length === 0) {
      addToast({ message: 'No records to export', type: 'info' })
      return
    }
    const { csv } = toCSV(records, enterprise.enterpriseType)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const today = format(new Date(), 'yyyy-MM-dd')
    const name = enterprise.name.replace(/ /g, '-')
    downloadBlob(blob, `records-${name}-${today}.csv`)
  }

  const sorted = records ? [...records].reverse() : null

  return (
    <div className="p-4 space-y-3">
      {/* Filter row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {DATE_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setFilterDays(f.days)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterDays === f.days
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 text-xs text-primary-600 font-medium px-2 py-1.5 rounded-lg active:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Download size={14} />
          CSV
        </button>
      </div>

      {/* Records list */}
      {sorted === null && (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      )}
      {sorted !== null && sorted.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No records in this period</p>
      )}
      {sorted?.map(record => {
        const r = record as any
        return (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.date}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {recordSummary(enterprise.enterpriseType, record)}
                </p>
                {r.notes && (
                  <p className="text-xs text-gray-400 mt-1 italic truncate">{r.notes}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                r.syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {r.syncStatus === 'synced' ? 'synced' : 'pending'}
              </span>
            </div>
            {r.activityType && (
              <p className="text-xs text-primary-600 font-medium mt-1.5 capitalize">
                {String(r.activityType).replace('_', ' ')}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
