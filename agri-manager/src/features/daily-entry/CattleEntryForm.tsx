import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLiveQuery } from 'dexie-react-hooks'
import { nanoid } from 'nanoid'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { db } from '../../core/database/db'
import { useDraftSave } from './hooks/useDraftSave'
import { NumberStepper } from '../../shared/components/entry/NumberStepper'
import { NumberInput } from '../../shared/components/entry/NumberInput'
import { RunningTotal } from '../../shared/components/entry/RunningTotal'
import { YesterdayRef } from '../../shared/components/entry/YesterdayRef'
import { SaveButton } from '../../shared/components/entry/SaveButton'
import { SectionCollapsible } from '../../shared/components/entry/SectionCollapsible'
import { syncCattleInventory } from '../../core/services/inventory-integration'
import type { EntryFormProps } from './EntryFormDispatcher'
import type { CattleDailyRecord } from '../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  milkMorning: string
  milkEvening: string
  milkingCount: number
  feedConsumedKg: string
  feedType: string
  currentHerdCount: string
  births: number
  healthNotes: string
  notes: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CattleEntryForm({ enterprise, date }: EntryFormProps) {
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const orgId    = useAuthStore(s => s.appUser?.organizationId) ?? ''
  const addToast = useUIStore(s => s.addToast)
  const [isSaving, setIsSaving]   = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [draftEnabled, setDraftEnabled] = useState(true)

  const isDairy = enterprise.enterpriseType === 'cattle_dairy'

  const form = useForm<FormValues>({
    defaultValues: {
      milkMorning: '',
      milkEvening: '',
      milkingCount: isDairy ? 2 : 0,
      feedConsumedKg: '',
      feedType: '',
      currentHerdCount: String(enterprise.currentStockCount),
      births: 0,
      healthNotes: '',
      notes: '',
    },
  })
  const { register, handleSubmit, watch, setValue, getValues, reset } = form

  const draftKey = `draft-cattle-${enterprise.id}-${date}`
  const { hasDraft, getDraft, clearDraft } = useDraftSave(draftKey, getValues, draftEnabled)

  // ── Load existing / draft ─────────────────────────────────────────────────

  const existingRecord = useLiveQuery(
    () => db.cattleDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, date])
      .first(),
    [enterprise.id, date],
  )

  const yesterdayRecord = useLiveQuery(async () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    const yDate = d.toISOString().split('T')[0]
    return db.cattleDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, yDate])
      .first()
  }, [enterprise.id, date])

  useEffect(() => {
    if (existingRecord === undefined) return
    if (existingRecord) {
      // Split total milk into morning/evening display (approximate 60/40 split if single value)
      const totalMilk = existingRecord.milkYieldLiters ?? 0
      const morning   = totalMilk > 0 ? String(Math.round(totalMilk * 0.6 * 10) / 10) : ''
      const evening   = totalMilk > 0 ? String(Math.round(totalMilk * 0.4 * 10) / 10) : ''
      reset({
        milkMorning:      morning,
        milkEvening:      evening,
        milkingCount:     existingRecord.milkingCount ?? (isDairy ? 2 : 0),
        feedConsumedKg:   String(existingRecord.feedConsumedKg ?? ''),
        feedType:         existingRecord.feedType ?? '',
        currentHerdCount: String(enterprise.currentStockCount),
        births:           existingRecord.births ?? 0,
        healthNotes:      existingRecord.healthNotes ?? '',
        notes:            existingRecord.notes ?? '',
      })
    } else {
      const draft = getDraft()
      if (draft) reset(draft.data)
      else if (yesterdayRecord !== undefined) {
        setValue('currentHerdCount', String(enterprise.currentStockCount))
        if (yesterdayRecord) setValue('births', yesterdayRecord.births ?? 0)
      }
    }
  }, [existingRecord, yesterdayRecord]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Running totals ────────────────────────────────────────────────────────

  const totalMilk = (parseFloat(watch('milkMorning')) || 0) + (parseFloat(watch('milkEvening')) || 0)

  // Derive deaths from current herd count + births
  const baseHerdCount  = existingRecord
    ? enterprise.currentStockCount + (existingRecord.deaths ?? 0) - (existingRecord.births ?? 0)
    : enterprise.currentStockCount
  const currentHerdCt  = parseInt(watch('currentHerdCount')) || 0
  const births         = watch('births')
  const derivedDeaths  = Math.max(0, baseHerdCount + births - currentHerdCt)

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const milk = isDairy
        ? (parseFloat(values.milkMorning) || 0) + (parseFloat(values.milkEvening) || 0)
        : undefined
      const currentHerdCt = parseInt(values.currentHerdCount) || 0
      const deaths        = Math.max(0, baseHerdCount + values.births - currentHerdCt)
      const record: CattleDailyRecord = {
        id:                   existingRecord?.id ?? nanoid(),
        enterpriseInstanceId: enterprise.id,
        date,
        recordedBy:           userId,
        milkYieldLiters:      milk,
        milkingCount:         isDairy ? values.milkingCount : undefined,
        feedConsumedKg:       parseFloat(values.feedConsumedKg) || undefined,
        feedType:             values.feedType || undefined,
        deaths:               deaths || undefined,
        births:               values.births || undefined,
        healthNotes:          values.healthNotes || undefined,
        notes:                values.notes || undefined,
        syncStatus:           'pending',
        createdAt:            existingRecord?.createdAt ?? now,
        updatedAt:            now,
      }
      await db.cattleDailyRecords.put(record)
      syncCattleInventory({
        orgId,
        enterpriseId: enterprise.id,
        enterpriseName: enterprise.name,
        date,
        isDairy,
        milkLiters: milk ?? 0,
        deaths,
        births: values.births ?? 0,
        prevMilk: existingRecord?.milkYieldLiters ?? 0,
        prevDeaths: existingRecord?.deaths ?? 0,
        prevBirths: existingRecord?.births ?? 0,
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
    ? yesterdayRecord.milkYieldLiters
      ? `${yesterdayRecord.milkYieldLiters} L milk`
      : `${yesterdayRecord.deaths ?? 0} deaths`
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

      {/* Milk (dairy only) */}
      {isDairy && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Milk Yield</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Morning"
              unit="L"
              isDecimal
              value={watch('milkMorning')}
              onChange={(v) => setValue('milkMorning', v)}
              min="0"
            />
            <NumberInput
              label="Evening"
              unit="L"
              isDecimal
              value={watch('milkEvening')}
              onChange={(v) => setValue('milkEvening', v)}
              min="0"
            />
          </div>
          <RunningTotal
            label="Total milk"
            value={`${Math.round(totalMilk * 10) / 10} L`}
            variant="success"
          />
          <YesterdayRef text={yPreview} />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Milkings/day</span>
            <NumberStepper
              label=""
              value={watch('milkingCount')}
              onChange={(v) => setValue('milkingCount', v)}
              min={1}
              max={4}
            />
          </div>
        </div>
      )}

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
          <input {...register('feedType')} placeholder="e.g. Silage, Hay, Concentrate" className="input-base" />
        </div>
      </div>

      {/* Herd events */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Herd Events</h3>
        <NumberInput
          label="Herd count today"
          value={watch('currentHerdCount')}
          onChange={(v) => setValue('currentHerdCount', v)}
          min="0"
        />
        <NumberStepper
          label="Births today"
          value={watch('births')}
          onChange={(v) => {
            const prev = watch('births')
            setValue('births', v)
            // Auto-raise herd count so births add to inventory, not deaths
            const herd = parseInt(watch('currentHerdCount')) || 0
            setValue('currentHerdCount', String(herd + v - prev))
          }}
          min={0}
        />
        <RunningTotal
          label="Deaths"
          value={`${derivedDeaths}`}
          variant={derivedDeaths > 0 ? 'danger' : 'default'}
        />
        {!isDairy && <YesterdayRef text={yPreview} />}
      </div>

      {/* Health notes */}
      <SectionCollapsible title="Health Notes">
        <textarea
          {...register('healthNotes')}
          rows={3}
          placeholder="Treatment, vaccination, illness observations…"
          className="input-base resize-none"
        />
      </SectionCollapsible>

      <SectionCollapsible title="Notes">
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Any other observations…"
          className="input-base resize-none"
        />
      </SectionCollapsible>

      <div className="h-2" />
      <SaveButton isLoading={isSaving} isSuccess={isSuccess} />
    </form>
  )
}
