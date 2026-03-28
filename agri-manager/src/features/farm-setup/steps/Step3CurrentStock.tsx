import { forwardRef, useImperativeHandle } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import type { EnterpriseType } from '../../../shared/types'
import {
  ENTERPRISE_ICONS, ENTERPRISE_LABELS,
  INFRA_SECTION_LABEL, ENTERPRISE_TO_INFRA_TYPE,
  STOCK_COUNT_LABEL, BREED_OPTIONS,
} from '../wizard-data'
import { useWizardStore, type StockEntry } from '../wizard-store'
import { DatePickerInput } from '../../../shared/components/wizard/DatePickerInput'
import { SearchableSelect } from '../../../shared/components/wizard/SearchableSelect'
import type { StepHandle } from './Step1Farm'

interface Step3FormValues {
  entries: StockEntry[]
}

interface Step3Props {
  onComplete: (data: Step3FormValues) => void
}

function StockCard({
  index,
  infraName,
  enterpriseType,
  control,
  register,
  getValues,
  setValue,
}: {
  index: number
  infraName: string
  enterpriseType: EnterpriseType
  control: any
  register: any
  getValues: any
  setValue: any
}) {
  const isActive = getValues(`entries.${index}.isActive`)
  const breedOptions = BREED_OPTIONS[enterpriseType] ?? []
  const stockLabel = STOCK_COUNT_LABEL[enterpriseType]
  const infraLabel = INFRA_SECTION_LABEL[ENTERPRISE_TO_INFRA_TYPE[enterpriseType]]

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      isActive ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{ENTERPRISE_ICONS[enterpriseType]}</span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight">{infraName}</p>
            <p className="text-xs text-gray-500">{infraLabel}</p>
          </div>
        </div>

        {/* Active toggle */}
        <Controller
          control={control}
          name={`entries.${index}.isActive`}
          render={({ field }) => (
            <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
              <span className="text-xs text-gray-500">Active</span>
              <div
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  field.value ? 'bg-primary-500' : 'bg-gray-300'
                }`}
                onClick={() => field.onChange(!field.value)}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  field.value ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </div>
            </label>
          )}
        />
      </div>

      {/* Active fields */}
      {isActive && (
        <>
          {/* Batch name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {ENTERPRISE_LABELS[enterpriseType]} Name
            </label>
            <input
              {...register(`entries.${index}.batchName`)}
              type="text"
              className="input-base text-sm"
              placeholder={`e.g. Batch 1`}
            />
          </div>

          {/* Start date */}
          <Controller
            control={control}
            name={`entries.${index}.startDate`}
            render={({ field }) => (
              <DatePickerInput
                label="Start Date"
                value={field.value}
                onChange={field.onChange}
                max={new Date().toISOString().split('T')[0]}
              />
            )}
          />

          {/* Stock count */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{stockLabel}</label>
            <input
              {...register(`entries.${index}.stockCount`)}
              type="number"
              inputMode="numeric"
              min="0"
              className="input-base text-sm"
              placeholder="0"
            />
          </div>

          {/* Breed / variety */}
          {breedOptions.length > 0 && (
            <Controller
              control={control}
              name={`entries.${index}.breedOrVariety`}
              render={({ field }) => {
                const isCustom = getValues(`entries.${index}.breedIsCustom`)
                const customText = getValues(`entries.${index}.breedCustomText`)
                return (
                  <SearchableSelect
                    label="Breed / Variety"
                    options={breedOptions}
                    value={isCustom ? 'other' : field.value}
                    customValue={customText}
                    placeholder="Select breed…"
                    onChange={(val, isOther, text) => {
                      setValue(`entries.${index}.breedIsCustom`, isOther)
                      setValue(`entries.${index}.breedCustomText`, text)
                      field.onChange(isOther ? 'other' : val)
                    }}
                  />
                )
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

export const Step3CurrentStock = forwardRef<StepHandle, Step3Props>((props, ref) => {
  const { stockEntries, infrastructures } = useWizardStore()

  const form = useForm<Step3FormValues>({
    defaultValues: { entries: stockEntries },
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: 'entries',
    keyName: 'fieldId',
  })

  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(props.onComplete)(),
  }), [form.handleSubmit, props.onComplete])

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-4xl mb-3">📦</p>
        <p className="text-gray-500 text-sm">
          No infrastructure added yet. Go back to Step 2 and add your houses, ponds, or fields.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-5">
      <p className="text-sm text-gray-500 mb-4">
        Toggle each unit active if it has animals or crops right now. You can add this later if you're not sure.
      </p>

      <div className="space-y-4">
        {fields.map((field, i) => {
          const infra = infrastructures.find(inf => inf.id === field.infraId)
          if (!infra) return null
          return (
            <StockCard
              key={field.fieldId}
              index={i}
              infraName={infra.name}
              enterpriseType={infra.enterpriseType}
              control={form.control}
              register={form.register}
              getValues={form.getValues}
              setValue={form.setValue}
            />
          )
        })}
      </div>
    </div>
  )
})

Step3CurrentStock.displayName = 'Step3CurrentStock'
