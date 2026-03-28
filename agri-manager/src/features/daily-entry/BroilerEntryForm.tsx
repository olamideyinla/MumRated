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
import { RunningTotal } from '../../shared/components/entry/RunningTotal'
import { SaveButton } from '../../shared/components/entry/SaveButton'
import { SectionCollapsible } from '../../shared/components/entry/SectionCollapsible'
import { syncBroilerInventory } from '../../core/services/inventory-integration'
import type { EntryFormProps } from './EntryFormDispatcher'
import type { BroilerDailyRecord } from '../../shared/types'

// ── Ross 308 standard weight (kg) by day (selected reference points) ──────────

const ROSS308_KG: [number, number][] = [
  [0, 0.042], [7, 0.18], [14, 0.44], [21, 0.82],
  [28, 1.28], [35, 1.79], [42, 2.32],
]

function ross308WeightForDay(day: number): number {
  if (day <= 0)  return ROSS308_KG[0][1]
  if (day >= 42) return ROSS308_KG[ROSS308_KG.length - 1][1]
  for (let i = 1; i < ROSS308_KG.length; i++) {
    const [d0, w0] = ROSS308_KG[i - 1]
    const [d1, w1] = ROSS308_KG[i]
    if (day <= d1) {
      const t = (day - d0) / (d1 - d0)
      return Math.round((w0 + t * (w1 - w0)) * 1000) / 1000
    }
  }
  return ROSS308_KG[ROSS308_KG.length - 1][1]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  currentBirdCount: string
  mortalityCause: string
  feedConsumedKg: string
  feedType: string
  waterConsumedLiters: string
  showWeightSampling: boolean
  bodyWeightSampleAvg: string
  bodyWeightSampleSize: string
  notes: string
}

const CAUSE_OPTIONS = ['', 'Disease', 'Heat Stress', 'Injury', 'Predator', 'Unknown', 'Other']

// ── Component ─────────────────────────────────────────────────────────────────

export function BroilerEntryForm({ enterprise, date }: EntryFormProps) {
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const orgId    = useAuthStore(s => s.appUser?.organizationId) ?? ''
  const addToast = useUIStore(s => s.addToast)
  const [isSaving, setIsSaving]   = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [draftEnabled, setDraftEnabled] = useState(true)

  const form = useForm<FormValues>({
    defaultValues: {
      currentBirdCount: String(enterprise.currentStockCount),
      mortalityCause: '',
      feedConsumedKg: '',
      feedType: '',
      waterConsumedLiters: '',
      showWeightSampling: false,
      bodyWeightSampleAvg: '',
      bodyWeightSampleSize: '',
      notes: '',
    },
  })
  const { register, handleSubmit, watch, setValue, getValues, reset } = form

  const draftKey = `draft-broiler-${enterprise.id}-${date}`
  const { hasDraft, getDraft, clearDraft } = useDraftSave(draftKey, getValues, draftEnabled)

  // ── Load existing / draft ─────────────────────────────────────────────────

  const existingRecord = useLiveQuery(
    () => db.broilerDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, date])
      .first(),
    [enterprise.id, date],
  )

  const yesterdayRecord = useLiveQuery(async () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    const yDate = d.toISOString().split('T')[0]
    return db.broilerDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, yDate])
      .first()
  }, [enterprise.id, date])

  useEffect(() => {
    if (existingRecord === undefined) return
    if (existingRecord) {
      reset({
        currentBirdCount:    String(enterprise.currentStockCount),
        mortalityCause:      existingRecord.mortalityCause ?? '',
        feedConsumedKg:      String(existingRecord.feedConsumedKg),
        feedType:            existingRecord.feedType ?? '',
        waterConsumedLiters: String(existingRecord.waterConsumedLiters ?? ''),
        showWeightSampling:  !!existingRecord.bodyWeightSampleAvg,
        bodyWeightSampleAvg: String(existingRecord.bodyWeightSampleAvg ?? ''),
        bodyWeightSampleSize: String(existingRecord.bodyWeightSampleSize ?? ''),
        notes:               existingRecord.notes ?? '',
      })
    } else {
      const draft = getDraft()
      if (draft) reset(draft.data)
      else if (yesterdayRecord !== undefined) {
        setValue('currentBirdCount', String(enterprise.currentStockCount))
      }
    }
  }, [existingRecord, yesterdayRecord]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Day-of-age & Ross 308 ─────────────────────────────────────────────────

  const startDate   = enterprise.startDate
  const dayOfAge    = Math.max(0, Math.round((new Date(date).getTime() - new Date(startDate).getTime()) / 86_400_000))
  const standardKg  = ross308WeightForDay(dayOfAge)
  const sampleAvg   = parseFloat(watch('bodyWeightSampleAvg')) || 0
  const vsStandard  = sampleAvg > 0 ? `${sampleAvg >= standardKg ? '+' : ''}${Math.round((sampleAvg - standardKg) * 1000)}g vs Ross 308` : null

  // Derive mortality from current live count
  const baseCount        = existingRecord
    ? enterprise.currentStockCount + (existingRecord.mortalityCount ?? 0)
    : enterprise.currentStockCount
  const currentBirdCt    = parseInt(watch('currentBirdCount')) || 0
  const derivedMortality = Math.max(0, baseCount - currentBirdCt)
  const initialStock     = enterprise.initialStockCount || 1
  const mortPct          = Math.round((derivedMortality / initialStock) * 1000) / 10

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const currentCt      = parseInt(values.currentBirdCount) || 0
      const mortalityCount = Math.max(0, baseCount - currentCt)
      const record: BroilerDailyRecord = {
        id:                   existingRecord?.id ?? nanoid(),
        enterpriseInstanceId: enterprise.id,
        date,
        recordedBy:           userId,
        mortalityCount,
        mortalityCause:       values.mortalityCause || undefined,
        feedConsumedKg:       parseFloat(values.feedConsumedKg) || 0,
        feedType:             values.feedType || undefined,
        waterConsumedLiters:  parseFloat(values.waterConsumedLiters) || undefined,
        bodyWeightSampleAvg:  values.showWeightSampling ? parseFloat(values.bodyWeightSampleAvg) || undefined : undefined,
        bodyWeightSampleSize: values.showWeightSampling ? parseInt(values.bodyWeightSampleSize) || undefined : undefined,
        notes:                values.notes || undefined,
        syncStatus:           'pending',
        createdAt:            existingRecord?.createdAt ?? now,
        updatedAt:            now,
      }
      await db.broilerDailyRecords.put(record)
      syncBroilerInventory({
        orgId,
        enterpriseId: enterprise.id,
        enterpriseName: enterprise.name,
        date,
        mortalityCount,
        prevMortality: existingRecord?.mortalityCount ?? 0,
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

  const yPreview = yesterdayRecord
    ? `${yesterdayRecord.mortalityCount} deaths · ${yesterdayRecord.feedConsumedKg} kg feed`
    : null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 pb-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {date} · Day {dayOfAge}
      </p>

      {hasDraft && !existingRecord && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
          <span>Draft restored</span>
          <button type="button" onClick={clearDraft} className="underline">Clear</button>
        </div>
      )}

      {/* Mortality */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Mortality</h3>
        <NumberInput
          label="Birds alive today"
          value={watch('currentBirdCount')}
          onChange={(v) => setValue('currentBirdCount', v)}
          min="0"
        />
        <div className="flex gap-2">
          <RunningTotal
            label="Deaths"
            value={`${derivedMortality}`}
            variant={mortPct > 5 ? 'danger' : mortPct > 2 ? 'warning' : 'default'}
          />
          <RunningTotal
            label="Mort %"
            value={`${mortPct}%`}
            variant={mortPct > 5 ? 'danger' : mortPct > 2 ? 'warning' : 'default'}
          />
        </div>
        <YesterdayRef text={yPreview} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cause</label>
          <select {...register('mortalityCause')} className="input-base">
            {CAUSE_OPTIONS.map(c => (
              <option key={c} value={c}>{c || 'Not specified'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Feed</h3>
        <NumberInput
          label="Feed consumed"
          unit="kg"
          isDecimal
          value={watch('feedConsumedKg')}
          onChange={(v) => setValue('feedConsumedKg', v)}
          min="0"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Feed type</label>
          <input {...register('feedType')} placeholder="e.g. Starter, Grower, Finisher" className="input-base" />
        </div>
      </div>

      {/* Weight sampling */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Weight Sampling</h3>
          <button
            type="button"
            onClick={() => setValue('showWeightSampling', !watch('showWeightSampling'))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              watch('showWeightSampling') ? 'bg-primary-500' : 'bg-gray-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              watch('showWeightSampling') ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
        {watch('showWeightSampling') && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Avg weight"
                unit="kg"
                isDecimal
                value={watch('bodyWeightSampleAvg')}
                onChange={(v) => setValue('bodyWeightSampleAvg', v)}
                min="0"
              />
              <NumberInput
                label="Sample size"
                value={watch('bodyWeightSampleSize')}
                onChange={(v) => setValue('bodyWeightSampleSize', v)}
                min="0"
              />
            </div>
            {vsStandard && (
              <p className="text-xs text-gray-500">
                Standard (Ross 308, day {dayOfAge}): <span className="font-semibold">{standardKg} kg</span>
                {' · '}<span className={sampleAvg >= standardKg ? 'text-emerald-600' : 'text-amber-600'}>{vsStandard}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Water */}
      <SectionCollapsible title="Water">
        <NumberInput
          label="Water consumed"
          unit="L"
          isDecimal
          value={watch('waterConsumedLiters')}
          onChange={(v) => setValue('waterConsumedLiters', v)}
          min="0"
        />
      </SectionCollapsible>

      <SectionCollapsible title="Notes">
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Any observations for today…"
          className="input-base resize-none"
        />
      </SectionCollapsible>

      <div className="h-2" />
      <SaveButton isLoading={isSaving} isSuccess={isSuccess} />
    </form>
  )
}
