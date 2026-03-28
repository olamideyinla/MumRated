import { forwardRef, useImperativeHandle, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, Loader2 } from 'lucide-react'
import { useWizardStore } from '../wizard-store'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  farmName: z.string().min(1, 'Farm name is required'),
  address: z.string(),
  gpsLat: z.string(),
  gpsLng: z.string(),
  areaValue: z.string(),
  areaUnit: z.enum(['hectares', 'acres']),
})

type FormData = z.infer<typeof schema>

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StepHandle { submit: () => void }

interface Step1Props {
  onComplete: (data: FormData) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Step1Farm = forwardRef<StepHandle, Step1Props>((props, ref) => {
  const { farmName, address, gpsLat, gpsLng, areaValue, areaUnit } = useWizardStore()
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { farmName, address, gpsLat, gpsLng, areaValue, areaUnit },
  })

  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(props.onComplete)(),
  }), [form.handleSubmit, props.onComplete])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue('gpsLat', String(pos.coords.latitude.toFixed(6)))
        form.setValue('gpsLng', String(pos.coords.longitude.toFixed(6)))
        setLocating(false)
      },
      (err) => {
        setLocError(
          err.code === 1 ? 'Location permission denied' :
          err.code === 2 ? 'Location unavailable' :
          'Could not get location — try again',
        )
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  const lat = form.watch('gpsLat')
  const lng = form.watch('gpsLng')
  const hasGps = lat && lng

  return (
    <form
      onSubmit={form.handleSubmit(props.onComplete)}
      noValidate
      className="space-y-5 px-4 py-5"
    >
      {/* Farm name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Farm Name <span className="text-red-500">*</span>
        </label>
        <input
          {...form.register('farmName')}
          type="text"
          className="input-base"
          placeholder="e.g. Green Valley Farm"
        />
        {form.formState.errors.farmName && (
          <p className="mt-1 text-xs text-red-600">{form.formState.errors.farmName.message}</p>
        )}
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address / Location <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...form.register('address')}
          rows={2}
          className="input-base resize-none"
          placeholder="e.g. 12 Farm Road, Nakuru, Kenya"
        />
      </div>

      {/* GPS coordinates */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          GPS Coordinates <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <button
          type="button"
          onClick={handleGetLocation}
          disabled={locating}
          className="btn-secondary w-full flex items-center justify-center gap-2 py-2.5"
        >
          {locating
            ? <Loader2 size={16} className="animate-spin" />
            : <MapPin size={16} />}
          {locating ? 'Getting location…' : 'Use my current location'}
        </button>
        {hasGps && (
          <p className="mt-1.5 text-xs text-emerald-600 font-medium">
            ✓ Location captured: {parseFloat(lat).toFixed(4)}°, {parseFloat(lng).toFixed(4)}°
          </p>
        )}
        {locError && <p className="mt-1 text-xs text-amber-600">{locError}</p>}

        {/* Hidden fields */}
        <input type="hidden" {...form.register('gpsLat')} />
        <input type="hidden" {...form.register('gpsLng')} />
      </div>

      {/* Farm area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Total Farm Area <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            {...form.register('areaValue')}
            type="number"
            inputMode="decimal"
            min="0"
            className="input-base flex-1"
            placeholder="e.g. 10"
          />
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-shrink-0">
            {(['hectares', 'acres'] as const).map(unit => (
              <button
                key={unit}
                type="button"
                onClick={() => form.setValue('areaUnit', unit)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  form.watch('areaUnit') === unit
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {unit === 'hectares' ? 'ha' : 'ac'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </form>
  )
})

Step1Farm.displayName = 'Step1Farm'
