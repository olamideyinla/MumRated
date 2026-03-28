import { Trash2 } from 'lucide-react'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { EnterpriseType } from '../../../shared/types'
import { CAPACITY_LABEL } from '../../../features/farm-setup/wizard-data'

export interface InfraFieldValues {
  id: string
  enterpriseType: EnterpriseType
  infraType: string
  name: string
  capacity: string
  pondVolumeM3: string
  areaM2: string
}

interface InfrastructureCardProps {
  index: number            // index into the flat useFieldArray
  fieldIndex: number       // display number (1-based) within the group
  enterpriseType: EnterpriseType
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  canRemove: boolean
  onRemove: () => void
}

export function InfrastructureCard({
  index,
  fieldIndex,
  enterpriseType,
  register,
  errors,
  canRemove,
  onRemove,
}: InfrastructureCardProps) {
  const isFish = enterpriseType === 'fish'
  const isCrop = enterpriseType === 'crop_annual' || enterpriseType === 'crop_perennial'
  const capacityLabel = CAPACITY_LABEL[enterpriseType]

  // Safely get nested error
  const itemErrors = (errors?.items as any)?.[index]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Unit #{fieldIndex}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 p-1 rounded-lg active:bg-red-50 transition-colors"
            aria-label="Remove"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register(`items.${index}.name`, { required: 'Name is required' })}
          type="text"
          className="input-base"
          placeholder={`e.g. House ${fieldIndex}`}
        />
        {itemErrors?.name && (
          <p className="mt-1 text-xs text-red-600">{itemErrors.name.message}</p>
        )}
      </div>

      {/* Capacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {capacityLabel} <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          {...register(`items.${index}.capacity`)}
          type="number"
          inputMode="numeric"
          min="0"
          className="input-base"
          placeholder="e.g. 5000"
        />
      </div>

      {/* Fish-specific: pond volume */}
      {isFish && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pond Volume (m³) <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            {...register(`items.${index}.pondVolumeM3`)}
            type="number"
            inputMode="decimal"
            min="0"
            className="input-base"
            placeholder="e.g. 500"
          />
        </div>
      )}

      {/* Crop-specific: area detail */}
      {isCrop && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Area (m²) <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            {...register(`items.${index}.areaM2`)}
            type="number"
            inputMode="decimal"
            min="0"
            className="input-base"
            placeholder="e.g. 10000"
          />
        </div>
      )}
    </div>
  )
}
