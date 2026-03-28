import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLiveQuery } from 'dexie-react-hooks'
import { nanoid } from 'nanoid'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { db } from '../../core/database/db'
import { useDraftSave } from './hooks/useDraftSave'
import { NumberInput } from '../../shared/components/entry/NumberInput'
import { YesterdayRef } from '../../shared/components/entry/YesterdayRef'
import { SaveButton } from '../../shared/components/entry/SaveButton'
import { SectionCollapsible } from '../../shared/components/entry/SectionCollapsible'
import { syncGenericAnimalInventory } from '../../core/services/inventory-integration'
import type { EntryFormProps } from './EntryFormDispatcher'
import type { FishDailyRecord } from '../../shared/types'

// ── Water quality ranges ──────────────────────────────────────────────────────

const WQ_ZONES = {
  waterTemp:         { ok: [22, 30], warn: [18, 34] },
  waterPh:           { ok: [6.5, 8.5], warn: [6, 9] },
  dissolvedOxygen:   { ok: [5, 14], warn: [3, 14] },
  ammonia:           { ok: [0, 0.02], warn: [0, 0.1] },
}

type WqKey = keyof typeof WQ_ZONES

function wqVariant(key: WqKey, value: number): 'success' | 'warning' | 'danger' | 'default' {
  const { ok, warn } = WQ_ZONES[key]
  if (value >= ok[0] && value <= ok[1]) return 'success'
  if (value >= warn[0] && value <= warn[1]) return 'warning'
  return 'danger'
}

const COLOR_MAP = { success: 'bg-emerald-50 border-emerald-200', warning: 'bg-amber-50 border-amber-200', danger: 'bg-red-50 border-red-200', default: 'bg-white border-gray-200' }
const TEXT_MAP  = { success: 'text-emerald-700', warning: 'text-amber-700', danger: 'text-red-700', default: 'text-gray-600' }

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  feedGivenKg: string
  feedType: string
  currentFishCount: string
  waterTemp: string
  waterPh: string
  dissolvedOxygen: string
  ammonia: string
  notes: string
}

interface WqFieldProps {
  label: string
  unit: string
  wqKey: WqKey
  value: string
  onChange: (v: string) => void
  rangeLabel: string
}

// ── Water quality field with color indicator ──────────────────────────────────

function WqField({ label, unit, wqKey, value, onChange, rangeLabel }: WqFieldProps) {
  const num     = parseFloat(value)
  const variant = !isNaN(num) && value !== '' ? wqVariant(wqKey, num) : 'default'
  return (
    <div className={`border rounded-xl p-3 ${COLOR_MAP[variant]}`}>
      <label className={`block text-xs font-semibold mb-1 ${TEXT_MAP[variant]}`}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-lg font-bold border-none outline-none p-0"
          placeholder="—"
        />
        <span className={`text-sm font-medium ${TEXT_MAP[variant]}`}>{unit}</span>
      </div>
      <p className={`text-xs mt-0.5 opacity-70 ${TEXT_MAP[variant]}`}>Ideal: {rangeLabel}</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FishEntryForm({ enterprise, date }: EntryFormProps) {
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const orgId    = useAuthStore(s => s.appUser?.organizationId) ?? ''
  const addToast = useUIStore(s => s.addToast)
  const [isSaving, setIsSaving]   = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [draftEnabled, setDraftEnabled] = useState(true)

  const form = useForm<FormValues>({
    defaultValues: {
      feedGivenKg: '', feedType: '', currentFishCount: String(enterprise.currentStockCount),
      waterTemp: '', waterPh: '', dissolvedOxygen: '', ammonia: '', notes: '',
    },
  })
  const { register, handleSubmit, watch, setValue, getValues, reset } = form

  const draftKey = `draft-fish-${enterprise.id}-${date}`
  const { hasDraft, getDraft, clearDraft } = useDraftSave(draftKey, getValues, draftEnabled)

  // ── Load existing / draft ─────────────────────────────────────────────────

  const existingRecord = useLiveQuery(
    () => db.fishDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, date])
      .first(),
    [enterprise.id, date],
  )

  const yesterdayRecord = useLiveQuery(async () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    const yDate = d.toISOString().split('T')[0]
    return db.fishDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, yDate])
      .first()
  }, [enterprise.id, date])

  useEffect(() => {
    if (existingRecord === undefined) return
    if (existingRecord) {
      reset({
        feedGivenKg:        String(existingRecord.feedGivenKg),
        feedType:           existingRecord.feedType ?? '',
        currentFishCount:   String(enterprise.currentStockCount),
        waterTemp:          String(existingRecord.waterTemp ?? ''),
        waterPh:            String(existingRecord.waterPh ?? ''),
        dissolvedOxygen:    String(existingRecord.dissolvedOxygen ?? ''),
        ammonia:            String(existingRecord.ammonia ?? ''),
        notes:              existingRecord.notes ?? '',
      })
    } else {
      const draft = getDraft()
      if (draft) reset(draft.data)
      else if (yesterdayRecord !== undefined) {
        setValue('currentFishCount', String(enterprise.currentStockCount))
      }
    }
  }, [existingRecord, yesterdayRecord]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive mortality from current fish count (must be before onSubmit)
  const baseFishCount    = existingRecord
    ? enterprise.currentStockCount + (existingRecord.estimatedMortality ?? 0)
    : enterprise.currentStockCount

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const currentFishCt    = parseInt(values.currentFishCount) || 0
      const estimatedMortality = Math.max(0, baseFishCount - currentFishCt) || undefined
      const record: FishDailyRecord = {
        id:                   existingRecord?.id ?? nanoid(),
        enterpriseInstanceId: enterprise.id,
        date,
        recordedBy:           userId,
        feedGivenKg:          parseFloat(values.feedGivenKg) || 0,
        feedType:             values.feedType || undefined,
        estimatedMortality,
        waterTemp:            parseFloat(values.waterTemp) || undefined,
        waterPh:              parseFloat(values.waterPh) || undefined,
        dissolvedOxygen:      parseFloat(values.dissolvedOxygen) || undefined,
        ammonia:              parseFloat(values.ammonia) || undefined,
        notes:                values.notes || undefined,
        syncStatus:           'pending',
        createdAt:            existingRecord?.createdAt ?? now,
        updatedAt:            now,
      }
      await db.fishDailyRecords.put(record)
      syncGenericAnimalInventory({
        orgId,
        enterpriseId:     enterprise.id,
        enterpriseName:   enterprise.name,
        unit:             'fish',
        date,
        mortalityCount:   estimatedMortality ?? 0,
        births:           0,
        headCountChange:  0,
        prevMortality:    existingRecord?.estimatedMortality ?? 0,
        prevBirths:       0,
        prevHeadCountChange: 0,
        userId,
      }).catch(() => {
        addToast({ message: 'Entry saved — stock count may be out of sync', type: 'warning' })
      })
      setDraftEnabled(false)
      clearDraft()
      setIsSuccess(true)
      addToast({ message: 'Entry saved', type: 'success' })
      setTimeout(() => setIsSuccess(false), 2500)
    } catch {
      addToast({ message: 'Failed to save — try again', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const currentFishCt    = parseInt(watch('currentFishCount')) || 0
  const derivedMortality = Math.max(0, baseFishCount - currentFishCt)

  const yPreview = yesterdayRecord
    ? `${yesterdayRecord.feedGivenKg} kg feed · ${yesterdayRecord.estimatedMortality ?? 0} mort.`
    : null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 pb-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{date}</p>

      {hasDraft && !existingRecord && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
          <span>Draft restored</span>
          <button type="button" onClick={clearDraft} className="underline">Clear</button>
        </div>
      )}

      {/* Feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Feed</h3>
        <NumberInput
          label="Feed given"
          unit="kg"
          isDecimal
          value={watch('feedGivenKg')}
          onChange={(v) => setValue('feedGivenKg', v)}
          min="0"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Feed type</label>
          <input {...register('feedType')} placeholder="e.g. Pellets 3mm, Crumbles" className="input-base" />
        </div>
        <NumberInput
          label="Fish alive today"
          value={watch('currentFishCount')}
          onChange={(v) => setValue('currentFishCount', v)}
          min="0"
        />
        {derivedMortality > 0 && (
          <p className="text-xs text-red-600 font-medium">↓ {derivedMortality} estimated deaths</p>
        )}
        <YesterdayRef text={yPreview} />
      </div>

      {/* Water quality */}
      <SectionCollapsible title="Water Quality" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <WqField label="Temperature" unit="°C" wqKey="waterTemp"
            value={watch('waterTemp')} onChange={(v) => setValue('waterTemp', v)}
            rangeLabel="22–30°C" />
          <WqField label="pH" unit="pH" wqKey="waterPh"
            value={watch('waterPh')} onChange={(v) => setValue('waterPh', v)}
            rangeLabel="6.5–8.5" />
          <WqField label="Dissolved O₂" unit="mg/L" wqKey="dissolvedOxygen"
            value={watch('dissolvedOxygen')} onChange={(v) => setValue('dissolvedOxygen', v)}
            rangeLabel="≥5 mg/L" />
          <WqField label="Ammonia" unit="mg/L" wqKey="ammonia"
            value={watch('ammonia')} onChange={(v) => setValue('ammonia', v)}
            rangeLabel="<0.02 mg/L" />
        </div>
      </SectionCollapsible>

      <SectionCollapsible title="Notes">
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Feeding behaviour, water colour, unusual observations…"
          className="input-base resize-none"
        />
      </SectionCollapsible>

      <div className="h-2" />
      <SaveButton isLoading={isSaving} isSuccess={isSuccess} />
    </form>
  )
}
