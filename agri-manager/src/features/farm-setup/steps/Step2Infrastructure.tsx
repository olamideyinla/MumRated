import { forwardRef, useImperativeHandle } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import type { EnterpriseType } from '../../../shared/types'
import {
  ENTERPRISE_LABELS, ENTERPRISE_ICONS, ENTERPRISE_TO_INFRA_TYPE,
  INFRA_SECTION_LABEL, ALL_ENTERPRISE_TYPES,
} from '../wizard-data'
import { useWizardStore, makeInfraItem, type InfraItem } from '../wizard-store'
import { InfrastructureCard } from '../../../shared/components/wizard/InfrastructureCard'
import { AddAnotherCard } from '../../../shared/components/wizard/AddAnotherCard'
import type { StepHandle } from './Step1Farm'

// ── Form types ────────────────────────────────────────────────────────────────

interface Step2FormValues {
  selectedTypes: EnterpriseType[]
  items: InfraItem[]
}

interface Step2Props {
  onComplete: (data: Step2FormValues) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Step2Infrastructure = forwardRef<StepHandle, Step2Props>((props, ref) => {
  const { selectedTypes, infrastructures } = useWizardStore()

  const form = useForm<Step2FormValues>({
    defaultValues: {
      selectedTypes,
      items: infrastructures,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'fieldId',
  })

  const watchedTypes = form.watch('selectedTypes')

  const handleTypeToggle = (type: EnterpriseType) => {
    const current = form.getValues('selectedTypes')
    if (current.includes(type)) {
      // Remove all infrastructure items for this type
      const indices: number[] = []
      fields.forEach((f, i) => { if (f.enterpriseType === type) indices.push(i) })
      indices.reverse().forEach(i => remove(i))
      form.setValue('selectedTypes', current.filter(t => t !== type))
    } else {
      const newTypes = [...current, type]
      form.setValue('selectedTypes', newTypes)
      // Add a default item for this type (count of existing items of this type = 0)
      append(makeInfraItem(type, 0))
    }
  }

  const handleAddAnother = (type: EnterpriseType) => {
    const count = fields.filter(f => f.enterpriseType === type).length
    append(makeInfraItem(type, count))
  }

  const validate = (): boolean => {
    const values = form.getValues()
    if (values.selectedTypes.length === 0) {
      form.setError('selectedTypes', { message: 'Select at least one type' })
      return false
    }
    let isValid = true
    values.items.forEach((item, i) => {
      if (!item.name.trim()) {
        form.setError(`items.${i}.name`, { message: 'Name is required' })
        isValid = false
      }
    })
    return isValid
  }

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (validate()) {
        form.handleSubmit(props.onComplete)()
      }
    },
  }), [form.handleSubmit, props.onComplete])

  const typeError = form.formState.errors.selectedTypes?.message

  return (
    <div className="px-4 py-5 space-y-6">
      {/* Enterprise type selection */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">What do you farm?</h2>
        <p className="text-xs text-gray-500 mb-3">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ENTERPRISE_TYPES.map(type => {
            const selected = watchedTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeToggle(type)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left ${
                  selected
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50'
                }`}
              >
                <span className="text-base">{ENTERPRISE_ICONS[type]}</span>
                <span className="leading-tight">{ENTERPRISE_LABELS[type]}</span>
              </button>
            )
          })}
        </div>
        {typeError && <p className="mt-2 text-xs text-red-600">{typeError}</p>}
      </div>

      {/* Infrastructure sections per selected type */}
      {watchedTypes.map(type => {
        const infraType = ENTERPRISE_TO_INFRA_TYPE[type]
        const typeFields = fields
          .map((f, i) => ({ ...f, index: i }))
          .filter(f => f.enterpriseType === type)

        return (
          <div key={type} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {INFRA_SECTION_LABEL[infraType]}
            </h3>

            {typeFields.map((field, groupIdx) => (
              <InfrastructureCard
                key={field.fieldId}
                index={field.index}
                fieldIndex={groupIdx + 1}
                enterpriseType={type}
                register={form.register}
                errors={form.formState.errors}
                canRemove={typeFields.length > 1}
                onRemove={() => remove(field.index)}
              />
            ))}

            <AddAnotherCard
              label={`Add another ${INFRA_SECTION_LABEL[infraType].replace(/^[^\s]+ /, '')}`}
              onClick={() => handleAddAnother(type)}
            />
          </div>
        )
      })}

      {watchedTypes.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">🌱</p>
          <p className="text-sm">Select your farming types above to get started</p>
        </div>
      )}
    </div>
  )
})

Step2Infrastructure.displayName = 'Step2Infrastructure'
