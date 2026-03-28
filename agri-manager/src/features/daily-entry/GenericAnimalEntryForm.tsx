/**
 * Handles: pigs_breeding, pigs_growfinish, rabbit, custom_animal
 */
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
import { syncGenericAnimalInventory } from '../../core/services/inventory-integration'
import type { EntryFormProps } from './EntryFormDispatcher'
import type {
  PigDailyRecord, RabbitDailyRecord, CustomAnimalDailyRecord, EnterpriseType,
} from '../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  currentAnimalCount: string
  mortalityCause: string
  feedConsumedKg: string
  feedType: string
  waterConsumedLiters: string
  birthCount: string
  weanCount: string
  matingCount: string
  avgBodyWeightSampleKg: string
  bodyWeightSampleSize: string
  metric1Name: string
  metric1Value: string
  metric2Name: string
  metric2Value: string
  metric3Name: string
  metric3Value: string
  healthNotes: string
  notes: string
}

const CAUSE_OPTIONS = ['', 'Disease', 'Heat Stress', 'Injury', 'Predator', 'Unknown', 'Other']

function isCustom(t: EnterpriseType) { return t === 'custom_animal' }
function isPig(t: EnterpriseType) { return t === 'pigs_breeding' || t === 'pigs_growfinish' }
function isBreeding(t: EnterpriseType) { return t === 'pigs_breeding' || t === 'rabbit' }

// ── Component ─────────────────────────────────────────────────────────────────

export function GenericAnimalEntryForm({ enterprise, date }: EntryFormProps) {
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const orgId    = useAuthStore(s => s.appUser?.organizationId) ?? ''
  const addToast = useUIStore(s => s.addToast)
  const [isSaving, setIsSaving]   = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [draftEnabled, setDraftEnabled] = useState(true)

  const type = enterprise.enterpriseType

  const form = useForm<FormValues>({
    defaultValues: {
      currentAnimalCount: String(enterprise.currentStockCount), mortalityCause: '',
      feedConsumedKg: '', feedType: '', waterConsumedLiters: '',
      birthCount: '', weanCount: '', matingCount: '',
      avgBodyWeightSampleKg: '', bodyWeightSampleSize: '',
      metric1Name: '', metric1Value: '',
      metric2Name: '', metric2Value: '',
      metric3Name: '', metric3Value: '',
      healthNotes: '', notes: '',
    },
  })
  const { register, handleSubmit, watch, setValue, getValues, reset } = form

  const tableKey = isPig(type) ? 'pig' : type === 'rabbit' ? 'rabbit' : 'custom'
  const draftKey = `draft-${tableKey}-${enterprise.id}-${date}`
  const { hasDraft, getDraft, clearDraft } = useDraftSave(draftKey, getValues, draftEnabled)

  // ── Load existing record ──────────────────────────────────────────────────

  const existingRecord = useLiveQuery(async () => {
    if (isPig(type)) {
      return db.pigDailyRecords.where('[enterpriseInstanceId+date]').equals([enterprise.id, date]).first()
    }
    if (type === 'rabbit') {
      return db.rabbitDailyRecords.where('[enterpriseInstanceId+date]').equals([enterprise.id, date]).first()
    }
    return db.customAnimalDailyRecords.where('[enterpriseInstanceId+date]').equals([enterprise.id, date]).first()
  }, [enterprise.id, date, type])

  const yesterdayRecord = useLiveQuery(async () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    const yDate = d.toISOString().split('T')[0]
    if (isPig(type)) {
      return db.pigDailyRecords.where('[enterpriseInstanceId+date]').equals([enterprise.id, yDate]).first()
    }
    if (type === 'rabbit') {
      return db.rabbitDailyRecords.where('[enterpriseInstanceId+date]').equals([enterprise.id, yDate]).first()
    }
    return db.customAnimalDailyRecords.where('[enterpriseInstanceId+date]').equals([enterprise.id, yDate]).first()
  }, [enterprise.id, date, type])

  useEffect(() => {
    if (existingRecord === undefined) return
    if (existingRecord) {
      const r = existingRecord as any
      reset({
        currentAnimalCount:   String(enterprise.currentStockCount),
        mortalityCause:       r.mortalityCause ?? '',
        feedConsumedKg:       String(r.feedConsumedKg ?? ''),
        feedType:             r.feedType ?? r.feedTypeName ?? '',
        waterConsumedLiters:  String(r.waterConsumedLiters ?? ''),
        birthCount:           String(r.birthCount ?? ''),
        weanCount:            String(r.weanCount ?? ''),
        matingCount:          String(r.matingCount ?? ''),
        avgBodyWeightSampleKg: String(r.avgBodyWeightSampleKg ?? ''),
        bodyWeightSampleSize:  String(r.bodyWeightSampleSize ?? ''),
        metric1Name:   r.metric1Name ?? '',
        metric1Value:  String(r.metric1Value ?? ''),
        metric2Name:   r.metric2Name ?? '',
        metric2Value:  String(r.metric2Value ?? ''),
        metric3Name:   r.metric3Name ?? '',
        metric3Value:  String(r.metric3Value ?? ''),
        healthNotes:   r.healthNotes ?? '',
        notes:         r.notes ?? '',
      })
    } else {
      const draft = getDraft()
      if (draft) reset(draft.data)
      else if (yesterdayRecord !== undefined) {
        setValue('currentAnimalCount', String(enterprise.currentStockCount))
        const yr = yesterdayRecord as any
        if (yr && (isPig(type) || type === 'rabbit')) {
          setValue('birthCount', String(yr.birthCount ?? ''))
        }
      }
    }
  }, [existingRecord, yesterdayRecord]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived counts ────────────────────────────────────────────────────────

  const r = existingRecord as any
  // Base count before today = current enterprise count + undo today's previously saved changes
  const baseAnimalCount = existingRecord
    ? isPig(type) || type === 'rabbit'
      // undo previous save: currentStockCount = base + births - wean - mortality
      ? enterprise.currentStockCount + (r.mortalityCount ?? 0) - (r.birthCount ?? 0) + (r.weanCount ?? 0)
      : isCustom(type)
        ? enterprise.currentStockCount - (r.headCountChange ?? 0) + (r.mortalityCount ?? 0)
        : enterprise.currentStockCount
    : enterprise.currentStockCount
  const currentAnimalCt = parseInt(watch('currentAnimalCount')) || 0
  const birthCt         = parseInt(watch('birthCount')) || 0
  const weanCt          = parseInt(watch('weanCount')) || 0
  // mortality = base + births - wean - current  (wean is alive removal, not death)
  const derivedMortality = (isPig(type) || type === 'rabbit')
    ? Math.max(0, baseAnimalCount + birthCt - weanCt - currentAnimalCt)
    : 0
  const derivedHeadChange = isCustom(type)
    ? currentAnimalCt - baseAnimalCount
    : 0

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const baseId = (existingRecord as any)?.id ?? nanoid()

      const currentCt      = parseInt(values.currentAnimalCount) || 0
      const births         = parseInt(values.birthCount) || 0
      const weaned         = parseInt(values.weanCount) || 0
      const mortalityCount = (isPig(type) || type === 'rabbit')
        ? Math.max(0, baseAnimalCount + births - weaned - currentCt)
        : 0
      const headCountChange = isCustom(type) ? currentCt - baseAnimalCount : 0

      if (isPig(type)) {
        const record: PigDailyRecord = {
          id:                   baseId,
          enterpriseInstanceId: enterprise.id,
          date,
          recordedBy:           userId,
          mortalityCount,
          mortalityCause:       values.mortalityCause || undefined,
          feedConsumedKg:       parseFloat(values.feedConsumedKg) || 0,
          feedType:             values.feedType || undefined,
          waterConsumedLiters:  parseFloat(values.waterConsumedLiters) || undefined,
          birthCount:           births || undefined,
          weanCount:            parseInt(values.weanCount) || undefined,
          avgBodyWeightSampleKg: parseFloat(values.avgBodyWeightSampleKg) || undefined,
          bodyWeightSampleSize:  parseInt(values.bodyWeightSampleSize) || undefined,
          healthNotes:          values.healthNotes || undefined,
          notes:                values.notes || undefined,
          syncStatus:           'pending',
          createdAt:            (existingRecord as any)?.createdAt ?? now,
          updatedAt:            now,
        }
        await db.pigDailyRecords.put(record)
        syncGenericAnimalInventory({
          orgId,
          enterpriseId:     enterprise.id,
          enterpriseName:   enterprise.name,
          unit:             'pigs',
          date,
          mortalityCount,
          births,
          headCountChange:     -weaned,
          prevMortality:       (existingRecord as any)?.mortalityCount ?? 0,
          prevBirths:          (existingRecord as any)?.birthCount ?? 0,
          prevHeadCountChange: -((existingRecord as any)?.weanCount ?? 0),
          userId,
        }).catch(() => {
          addToast({ message: 'Entry saved — stock count may be out of sync', type: 'warning' })
        })
      } else if (type === 'rabbit') {
        const record: RabbitDailyRecord = {
          id:                   baseId,
          enterpriseInstanceId: enterprise.id,
          date,
          recordedBy:           userId,
          mortalityCount,
          mortalityCause:       values.mortalityCause || undefined,
          feedConsumedKg:       parseFloat(values.feedConsumedKg) || 0,
          feedType:             values.feedType || undefined,
          waterConsumedLiters:  parseFloat(values.waterConsumedLiters) || undefined,
          birthCount:           births || undefined,
          weanCount:            parseInt(values.weanCount) || undefined,
          matingCount:          parseInt(values.matingCount) || undefined,
          avgBodyWeightSampleKg: parseFloat(values.avgBodyWeightSampleKg) || undefined,
          notes:                values.notes || undefined,
          syncStatus:           'pending',
          createdAt:            (existingRecord as any)?.createdAt ?? now,
          updatedAt:            now,
        }
        await db.rabbitDailyRecords.put(record)
        syncGenericAnimalInventory({
          orgId,
          enterpriseId:     enterprise.id,
          enterpriseName:   enterprise.name,
          unit:             'rabbits',
          date,
          mortalityCount,
          births,
          headCountChange:     -weaned,
          prevMortality:       (existingRecord as any)?.mortalityCount ?? 0,
          prevBirths:          (existingRecord as any)?.birthCount ?? 0,
          prevHeadCountChange: -((existingRecord as any)?.weanCount ?? 0),
          userId,
        }).catch(() => {
          addToast({ message: 'Entry saved — stock count may be out of sync', type: 'warning' })
        })
      } else {
        const record: CustomAnimalDailyRecord = {
          id:                   baseId,
          enterpriseInstanceId: enterprise.id,
          date,
          recordedBy:           userId,
          animalType:           enterprise.breedOrVariety ?? undefined,
          mortalityCount:       headCountChange < 0 ? Math.abs(headCountChange) : undefined,
          mortalityCause:       values.mortalityCause || undefined,
          feedConsumedKg:       parseFloat(values.feedConsumedKg) || undefined,
          feedTypeName:         values.feedType || undefined,
          waterConsumedLiters:  parseFloat(values.waterConsumedLiters) || undefined,
          headCountChange:      headCountChange || undefined,
          metric1Name:  values.metric1Name || undefined,
          metric1Value: parseFloat(values.metric1Value) || undefined,
          metric2Name:  values.metric2Name || undefined,
          metric2Value: parseFloat(values.metric2Value) || undefined,
          metric3Name:  values.metric3Name || undefined,
          metric3Value: parseFloat(values.metric3Value) || undefined,
          healthNotes:  values.healthNotes || undefined,
          notes:        values.notes || undefined,
          syncStatus:   'pending',
          createdAt:    (existingRecord as any)?.createdAt ?? now,
          updatedAt:    now,
        }
        await db.customAnimalDailyRecords.put(record)
        syncGenericAnimalInventory({
          orgId,
          enterpriseId:     enterprise.id,
          enterpriseName:   enterprise.name,
          unit:             enterprise.breedOrVariety ?? 'animals',
          date,
          mortalityCount:   headCountChange < 0 ? Math.abs(headCountChange) : 0,
          births:           0,
          headCountChange,
          prevMortality:    (existingRecord as any)?.mortalityCount ?? 0,
          prevBirths:       0,
          prevHeadCountChange: (existingRecord as any)?.headCountChange ?? 0,
          userId,
        }).catch(() => {
          addToast({ message: 'Entry saved — stock count may be out of sync', type: 'warning' })
        })
      }

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

  const yRec    = yesterdayRecord as any
  const yPreview = yRec
    ? `${yRec.mortalityCount ?? 0} deaths · ${yRec.feedConsumedKg ?? yRec.feedTypeName ?? 0} kg feed`
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

      {/* Animal count / mortality */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">
          {isCustom(type) ? 'Animal Count' : 'Mortality'}
        </h3>
        <NumberInput
          label={isPig(type) ? 'Pigs alive today' : type === 'rabbit' ? 'Rabbits alive today' : 'Animals alive today'}
          value={watch('currentAnimalCount')}
          onChange={(v) => setValue('currentAnimalCount', v)}
          min="0"
        />
        {(isPig(type) || type === 'rabbit') && derivedMortality > 0 && (
          <RunningTotal
            label="Deaths"
            value={`${derivedMortality}`}
            variant="danger"
          />
        )}
        {isCustom(type) && derivedHeadChange !== 0 && (
          <p className={`text-xs font-medium ${derivedHeadChange < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {derivedHeadChange > 0 ? `+${derivedHeadChange} additions` : `${Math.abs(derivedHeadChange)} reduction`}
          </p>
        )}
        <YesterdayRef text={yPreview} />
        {!isCustom(type) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cause</label>
            <select {...register('mortalityCause')} className="input-base">
              {CAUSE_OPTIONS.map(c => (
                <option key={c} value={c}>{c || 'Not specified'}</option>
              ))}
            </select>
          </div>
        )}
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
          <input {...register('feedType')} placeholder="e.g. Grower Pellets, Mash" className="input-base" />
        </div>
      </div>

      {/* Reproduction (breeding types) */}
      {isBreeding(type) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {isPig(type) ? 'Farrowing / Weaning' : 'Reproduction'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label={isPig(type) ? 'Piglets born' : 'Kittens born'}
              value={watch('birthCount')}
              onChange={(v) => {
                const prev = parseInt(watch('birthCount')) || 0
                const next = parseInt(v) || 0
                setValue('birthCount', v)
                // Auto-raise the alive count so births add to inventory, not deaths
                const alive = parseInt(watch('currentAnimalCount')) || 0
                setValue('currentAnimalCount', String(alive + next - prev))
              }}
              min="0"
            />
            <NumberInput
              label={isPig(type) ? 'Piglets weaned' : 'Kittens weaned'}
              value={watch('weanCount')}
              onChange={(v) => {
                const prev = parseInt(watch('weanCount')) || 0
                const next = parseInt(v) || 0
                setValue('weanCount', v)
                // Auto-reduce alive count — weaned animals leave (alive, not dead)
                const alive = parseInt(watch('currentAnimalCount')) || 0
                setValue('currentAnimalCount', String(Math.max(0, alive - (next - prev))))
              }}
              min="0"
            />
          </div>
          {type === 'rabbit' && (
            <NumberInput
              label="Matings today"
              value={watch('matingCount')}
              onChange={(v) => setValue('matingCount', v)}
              min="0"
            />
          )}
        </div>
      )}

      {/* Weight sampling */}
      <SectionCollapsible title="Weight Sampling">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Avg weight"
            unit="kg"
            isDecimal
            value={watch('avgBodyWeightSampleKg')}
            onChange={(v) => setValue('avgBodyWeightSampleKg', v)}
            min="0"
          />
          <NumberInput
            label="Sample size"
            value={watch('bodyWeightSampleSize')}
            onChange={(v) => setValue('bodyWeightSampleSize', v)}
            min="0"
          />
        </div>
      </SectionCollapsible>

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

      {/* Custom metrics */}
      {isCustom(type) && (
        <SectionCollapsible title="Custom Metrics">
          <div className="space-y-3">
            {([1, 2, 3] as const).map(n => (
              <div key={n} className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Metric {n} name</label>
                  <input
                    {...register(`metric${n}Name` as keyof FormValues)}
                    placeholder="e.g. Milk yield"
                    className="input-base text-sm"
                  />
                </div>
                <NumberInput
                  label="Value"
                  isDecimal
                  value={watch(`metric${n}Value` as keyof FormValues) as string}
                  onChange={(v) => setValue(`metric${n}Value` as keyof FormValues, v)}
                />
              </div>
            ))}
          </div>
        </SectionCollapsible>
      )}

      {/* Health & notes */}
      <SectionCollapsible title="Health & Notes">
        <textarea
          {...register('healthNotes')}
          rows={2}
          placeholder="Treatment, vaccination, illness…"
          className="input-base resize-none"
        />
        <textarea
          {...register('notes')}
          rows={2}
          placeholder="Any other observations…"
          className="input-base resize-none mt-3"
        />
      </SectionCollapsible>

      <div className="h-2" />
      <SaveButton isLoading={isSaving} isSuccess={isSuccess} />
    </form>
  )
}
