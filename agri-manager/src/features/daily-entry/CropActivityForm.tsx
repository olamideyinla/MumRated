import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { nanoid } from 'nanoid'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import { db } from '../../core/database/db'
import { NumberInput } from '../../shared/components/entry/NumberInput'
import { SaveButton } from '../../shared/components/entry/SaveButton'
import { SectionCollapsible } from '../../shared/components/entry/SectionCollapsible'
import type { EntryFormProps } from './EntryFormDispatcher'
import type { CropActivityType, CropActivityRecord } from '../../shared/types'

// ── Activity type config ──────────────────────────────────────────────────────

const ACTIVITY_TYPES: { value: CropActivityType; label: string; icon: string }[] = [
  { value: 'planting',    label: 'Planting',    icon: '🌱' },
  { value: 'fertilizing', label: 'Fertilizing', icon: '🌿' },
  { value: 'spraying',    label: 'Spraying',    icon: '💧' },
  { value: 'weeding',     label: 'Weeding',     icon: '🪴' },
  { value: 'irrigating',  label: 'Irrigating',  icon: '🚿' },
  { value: 'harvesting',  label: 'Harvesting',  icon: '🌾' },
  { value: 'scouting',    label: 'Scouting',    icon: '🔍' },
  { value: 'other',       label: 'Other',       icon: '📋' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  activityType: CropActivityType
  inputUsed: string
  inputQuantity: string
  inputUnit: string
  laborHours: string
  workerCount: string
  harvestQuantityKg: string
  harvestGrade: string
  growthStage: string
  pestOrDisease: string
  severity: string
  notes: string
}

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function CropActivityForm({ enterprise, date }: EntryFormProps) {
  const userId   = useAuthStore(s => s.user?.id) ?? ''
  const addToast = useUIStore(s => s.addToast)
  const [isSaving, setIsSaving]   = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [selectedType, setSelectedType] = useState<CropActivityType>('planting')

  const form = useForm<FormValues>({
    defaultValues: {
      activityType:      'planting',
      inputUsed:         '',
      inputQuantity:     '',
      inputUnit:         '',
      laborHours:        '',
      workerCount:       '',
      harvestQuantityKg: '',
      harvestGrade:      '',
      growthStage:       '',
      pestOrDisease:     '',
      severity:          '',
      notes:             '',
    },
  })
  const { register, handleSubmit, watch, setValue, getValues } = form

  // Note: Crop records are INSERTs (multiple allowed per day), no compound-index upsert

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const record: CropActivityRecord = {
        id:                   nanoid(),
        enterpriseInstanceId: enterprise.id,
        date,
        recordedBy:           userId,
        activityType:         selectedType,
        inputUsed:            values.inputUsed || undefined,
        inputQuantity:        parseFloat(values.inputQuantity) || undefined,
        inputUnit:            values.inputUnit || undefined,
        laborHours:           parseFloat(values.laborHours) || undefined,
        workerCount:          parseInt(values.workerCount) || undefined,
        harvestQuantityKg:    selectedType === 'harvesting' ? parseFloat(values.harvestQuantityKg) || undefined : undefined,
        harvestGrade:         selectedType === 'harvesting' ? values.harvestGrade || undefined : undefined,
        growthStage:          values.growthStage || undefined,
        pestOrDisease:        selectedType === 'scouting' ? values.pestOrDisease || undefined : undefined,
        severity:             selectedType === 'scouting' ? (values.severity as CropActivityRecord['severity']) || undefined : undefined,
        notes:                values.notes || undefined,
        syncStatus:           'pending',
        createdAt:            now,
        updatedAt:            now,
      }
      await db.cropActivityRecords.add(record)
      setIsSuccess(true)
      addToast({ message: 'Activity recorded', type: 'success' })
      // Reset form for another entry
      setTimeout(() => {
        setIsSuccess(false)
        form.reset()
        setSelectedType('planting')
      }, 2000)
    } catch {
      addToast({ message: 'Failed to save — try again', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const showInput    = selectedType === 'fertilizing' || selectedType === 'spraying' || selectedType === 'planting'
  const showHarvest  = selectedType === 'harvesting'
  const showScouting = selectedType === 'scouting'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 pb-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{date}</p>

      {/* Activity type */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Activity Type</h3>
        <div className="grid grid-cols-4 gap-2">
          {ACTIVITY_TYPES.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedType(value)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-colors ${
                selectedType === value
                  ? 'bg-primary-50 border-primary-400 text-primary-700'
                  : 'border-gray-200 text-gray-600 active:bg-gray-50'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input details (fertilizing / spraying / planting) */}
      {showInput && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Input Used</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product name</label>
            <input
              {...register('inputUsed')}
              placeholder="e.g. Urea, Glyphosate, Hybrid seed"
              className="input-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Quantity"
              isDecimal
              value={watch('inputQuantity')}
              onChange={(v) => setValue('inputQuantity', v)}
              min="0"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                {...register('inputUnit')}
                placeholder="kg, L, bags…"
                className="input-base"
              />
            </div>
          </div>
        </div>
      )}

      {/* Harvest details */}
      {showHarvest && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Harvest</h3>
          <NumberInput
            label="Quantity harvested"
            unit="kg"
            isDecimal
            value={watch('harvestQuantityKg')}
            onChange={(v) => setValue('harvestQuantityKg', v)}
            min="0"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
            <input
              {...register('harvestGrade')}
              placeholder="e.g. Grade A, Export, Local"
              className="input-base"
            />
          </div>
        </div>
      )}

      {/* Scouting details */}
      {showScouting && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Pest / Disease</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identified pest or disease</label>
            <input
              {...register('pestOrDisease')}
              placeholder="e.g. Aphids, Rust, Fall Armyworm"
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select {...register('severity')} className="input-base">
              {SEVERITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Labour & growth stage */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Labour</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Labour hours"
            isDecimal
            value={watch('laborHours')}
            onChange={(v) => setValue('laborHours', v)}
            min="0"
          />
          <NumberInput
            label="Workers"
            value={watch('workerCount')}
            onChange={(v) => setValue('workerCount', v)}
            min="0"
          />
        </div>
      </div>

      <SectionCollapsible title="Growth Stage & Notes">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Growth stage</label>
          <input
            {...register('growthStage')}
            placeholder="e.g. Vegetative V6, Flowering, Grain fill"
            className="input-base"
          />
        </div>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Weather, field conditions, observations…"
          className="input-base resize-none"
        />
      </SectionCollapsible>

      <div className="h-2" />
      <SaveButton label="RECORD ACTIVITY" isLoading={isSaving} isSuccess={isSuccess} />
    </form>
  )
}
