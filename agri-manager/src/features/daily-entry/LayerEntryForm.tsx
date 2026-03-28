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
import { syncLayerInventory } from '../../core/services/inventory-integration'
import type { EntryFormProps } from './EntryFormDispatcher'
import type { LayerDailyRecord } from '../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  eggInput: string       // raw input — may be trays or crates
  brokenEggs: string
  rejectEggs: string
  currentHenCount: string
  mortalityCause: string
  feedConsumedKg: string
  feedType: string
  waterConsumedLiters: string
  temperatureHigh: string
  temperatureLow: string
  notes: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAUSE_OPTIONS = [
  '', 'Disease', 'Heat Stress', 'Injury', 'Predator', 'Unknown', 'Other',
]

function eggLabel(unit: string) {
  if (unit === 'tray30') return 'Trays (30-egg)'
  if (unit === 'crate360') return 'Crates (360-egg)'
  return 'Individual Eggs'
}

function toActualEggs(raw: number, unit: string): number {
  if (unit === 'tray30')   return raw * 30
  if (unit === 'crate360') return raw * 360
  return raw
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LayerEntryForm({ enterprise, date }: EntryFormProps) {
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const orgId    = useAuthStore(s => s.appUser?.organizationId) ?? ''
  const addToast = useUIStore(s => s.addToast)
  const [isSaving, setIsSaving]   = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [draftEnabled, setDraftEnabled] = useState(true)

  // Egg count unit from wizard preferences (default = individual)
  const eggUnit = useLiveQuery(async () => {
    if (!userId) return 'individual'
    const user = await db.appUsers.get(userId)
    if (!user) return 'individual'
    const org = await db.organizations.get(user.organizationId)
    return (org as any)?.eggCountUnit ?? 'individual'
  }, [userId]) ?? 'individual'

  const form = useForm<FormValues>({
    defaultValues: {
      eggInput: '',
      brokenEggs: '',
      rejectEggs: '',
      currentHenCount: String(enterprise.currentStockCount),
      mortalityCause: '',
      feedConsumedKg: '',
      feedType: '',
      waterConsumedLiters: '',
      temperatureHigh: '',
      temperatureLow: '',
      notes: '',
    },
  })
  const { register, handleSubmit, watch, setValue, getValues, reset, formState: { errors } } = form

  const draftKey = `draft-layer-${enterprise.id}-${date}`
  const { hasDraft, getDraft, clearDraft } = useDraftSave(draftKey, getValues, draftEnabled)

  // ── Load existing record or draft ──────────────────────────────────────────

  const existingRecord = useLiveQuery(
    () => db.layerDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, date])
      .first(),
    [enterprise.id, date],
  )

  const yesterdayRecord = useLiveQuery(async () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    const yDate = d.toISOString().split('T')[0]
    return db.layerDailyRecords
      .where('[enterpriseInstanceId+date]')
      .equals([enterprise.id, yDate])
      .first()
  }, [enterprise.id, date])

  useEffect(() => {
    if (existingRecord === undefined) return  // still loading
    if (existingRecord) {
      // Convert stored egg count back to display unit
      const raw = eggUnit === 'tray30'
        ? String(Math.round(existingRecord.totalEggs / 30))
        : eggUnit === 'crate360'
          ? String(Math.round(existingRecord.totalEggs / 360))
          : String(existingRecord.totalEggs)
      reset({
        eggInput:           raw,
        brokenEggs:         String(existingRecord.brokenEggs ?? ''),
        rejectEggs:         String(existingRecord.rejectEggs ?? ''),
        currentHenCount:    String(enterprise.currentStockCount),
        mortalityCause:     existingRecord.mortalityCause ?? '',
        feedConsumedKg:     String(existingRecord.feedConsumedKg),
        feedType:           existingRecord.feedType ?? '',
        waterConsumedLiters: String(existingRecord.waterConsumedLiters ?? ''),
        temperatureHigh:    String(existingRecord.temperatureHigh ?? ''),
        temperatureLow:     String(existingRecord.temperatureLow ?? ''),
        notes:              existingRecord.notes ?? '',
      })
    } else {
      // Try to restore draft
      const draft = getDraft()
      if (draft) reset(draft.data)
      else if (yesterdayRecord !== undefined) {
        setValue('currentHenCount', String(enterprise.currentStockCount))
      }
    }
  }, [existingRecord, eggUnit, yesterdayRecord]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Running totals ─────────────────────────────────────────────────────────

  const rawEgg    = parseFloat(watch('eggInput')) || 0
  const totalEggs = toActualEggs(rawEgg, eggUnit)
  const stockCount = enterprise.currentStockCount || 1
  const hdpPct    = stockCount > 0 ? Math.round((totalEggs / stockCount) * 1000) / 10 : 0

  // Derive mortality from current hen count
  const baseHenCount     = existingRecord
    ? enterprise.currentStockCount + (existingRecord.mortalityCount ?? 0)
    : enterprise.currentStockCount
  const currentHenCt     = parseInt(watch('currentHenCount')) || 0
  const derivedMortality = Math.max(0, baseHenCount - currentHenCt)

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const now  = new Date().toISOString()
      const eggs = toActualEggs(parseFloat(values.eggInput) || 0, eggUnit)
      const currentHenCt   = parseInt(values.currentHenCount) || 0
      const mortalityCount = Math.max(0, baseHenCount - currentHenCt)
      const record: LayerDailyRecord = {
        id:                   existingRecord?.id ?? nanoid(),
        enterpriseInstanceId: enterprise.id,
        date,
        recordedBy:           userId,
        totalEggs:            eggs,
        brokenEggs:           parseFloat(values.brokenEggs) || undefined,
        rejectEggs:           parseFloat(values.rejectEggs) || undefined,
        mortalityCount,
        mortalityCause:       values.mortalityCause || undefined,
        feedConsumedKg:       parseFloat(values.feedConsumedKg) || 0,
        feedType:             values.feedType || undefined,
        waterConsumedLiters:  parseFloat(values.waterConsumedLiters) || undefined,
        temperatureHigh:      parseFloat(values.temperatureHigh) || undefined,
        temperatureLow:       parseFloat(values.temperatureLow) || undefined,
        notes:                values.notes || undefined,
        syncStatus:           'pending',
        createdAt:            existingRecord?.createdAt ?? now,
        updatedAt:            now,
      }
      await db.layerDailyRecords.put(record)
      syncLayerInventory({
        orgId,
        enterpriseId: enterprise.id,
        enterpriseName: enterprise.name,
        date,
        totalEggs: eggs,
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
    ? `${yesterdayRecord.totalEggs} eggs · ${yesterdayRecord.mortalityCount} deaths`
    : null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 pb-2">
      {/* Date indicator */}
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{date}</p>

      {hasDraft && !existingRecord && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
          <span>Draft restored</span>
          <button type="button" onClick={clearDraft} className="underline">Clear</button>
        </div>
      )}

      {/* Egg collection */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Egg Collection</h3>
        <NumberInput
          label={eggLabel(eggUnit)}
          value={watch('eggInput')}
          onChange={(v) => setValue('eggInput', v)}
          min="0"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <RunningTotal
            label="Total eggs"
            value={totalEggs.toLocaleString()}
            variant={hdpPct >= 70 ? 'success' : hdpPct >= 50 ? 'warning' : 'danger'}
          />
          <RunningTotal
            label="HDP"
            value={`${hdpPct}%`}
            variant={hdpPct >= 70 ? 'success' : hdpPct >= 50 ? 'warning' : 'danger'}
          />
        </div>
        <YesterdayRef text={yPreview} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Broken"
            value={watch('brokenEggs')}
            onChange={(v) => setValue('brokenEggs', v)}
            min="0"
          />
          <NumberInput
            label="Rejected"
            value={watch('rejectEggs')}
            onChange={(v) => setValue('rejectEggs', v)}
            min="0"
          />
        </div>
      </div>

      {/* Mortality */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Mortality</h3>
        <NumberInput
          label="Hens alive today"
          value={watch('currentHenCount')}
          onChange={(v) => setValue('currentHenCount', v)}
          min="0"
        />
        <RunningTotal
          label="Deaths"
          value={`${derivedMortality}`}
          variant={derivedMortality > 0 ? 'danger' : 'default'}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cause</label>
          <select
            {...register('mortalityCause')}
            className="input-base"
          >
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
          <input
            {...register('feedType')}
            placeholder="e.g. Layer Pellets, Mash"
            className="input-base"
          />
        </div>
      </div>

      {/* Collapsible: Water & Temp */}
      <SectionCollapsible title="Water & Temperature">
        <NumberInput
          label="Water consumed"
          unit="L"
          isDecimal
          value={watch('waterConsumedLiters')}
          onChange={(v) => setValue('waterConsumedLiters', v)}
          min="0"
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="High temp"
            unit="°C"
            isDecimal
            value={watch('temperatureHigh')}
            onChange={(v) => setValue('temperatureHigh', v)}
          />
          <NumberInput
            label="Low temp"
            unit="°C"
            isDecimal
            value={watch('temperatureLow')}
            onChange={(v) => setValue('temperatureLow', v)}
          />
        </div>
      </SectionCollapsible>

      {/* Collapsible: Notes */}
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
