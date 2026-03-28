import { forwardRef, useImperativeHandle, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useWizardStore } from '../wizard-store'
import { LANGUAGES } from '../wizard-data'
import type { StepHandle } from './Step1Farm'

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR',
  'UGX', 'TZS', 'ETB', 'XOF', 'INR', 'PHP', 'BRL', 'MXN', 'CAD', 'AUD',
]

const schema = z.object({
  unitSystem: z.enum(['metric', 'imperial']),
  eggCountUnit: z.enum(['individual', 'tray30', 'crate360']),
  feedBagKg: z.string(),
  feedBagCustom: z.string(),
  currency: z.string().min(1),
  reminderTime: z.string(),
  language: z.string(),
})

type FormData = z.infer<typeof schema>

interface Step4Props {
  onComplete: (data: FormData) => void
}

export const Step4Settings = forwardRef<StepHandle, Step4Props>((props, ref) => {
  const state = useWizardStore()
  const hasLayers = state.selectedTypes.includes('layers')
  const [showCustomBag, setShowCustomBag] = useState(
    state.feedBagKg !== '25' && state.feedBagKg !== '50',
  )

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      unitSystem: state.unitSystem,
      eggCountUnit: state.eggCountUnit,
      feedBagKg: showCustomBag ? 'other' : state.feedBagKg,
      feedBagCustom: showCustomBag ? state.feedBagKg : '',
      currency: state.currency,
      reminderTime: state.reminderTime,
      language: state.language,
    },
  })

  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(props.onComplete)(),
  }), [form.handleSubmit, props.onComplete])

  const unitSystem = form.watch('unitSystem')
  const eggUnit = form.watch('eggCountUnit')
  const feedBag = form.watch('feedBagKg')

  return (
    <form
      onSubmit={form.handleSubmit(props.onComplete)}
      noValidate
      className="px-4 py-5 space-y-6"
    >
      {/* Units */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Measurement Units</label>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['metric', 'imperial'] as const).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => form.setValue('unitSystem', u)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                unitSystem === u ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {u === 'metric' ? 'Metric (kg, m)' : 'Imperial (lb, ft)'}
            </button>
          ))}
        </div>
      </div>

      {/* Egg counting — layers only */}
      {hasLayers && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            How do you count eggs?
          </label>
          <div className="space-y-2">
            {([
              { value: 'individual', label: 'Individual eggs' },
              { value: 'tray30',     label: 'Trays of 30' },
              { value: 'crate360',   label: 'Crates of 360' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  eggUnit === opt.value
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  {...form.register('eggCountUnit')}
                  value={opt.value}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Feed bag weight */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Standard feed bag size
        </label>
        <div className="flex gap-2 mb-2">
          {(['25', '50'] as const).map(kg => (
            <button
              key={kg}
              type="button"
              onClick={() => { form.setValue('feedBagKg', kg); setShowCustomBag(false) }}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                feedBag === kg
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {kg} kg
            </button>
          ))}
          <button
            type="button"
            onClick={() => { form.setValue('feedBagKg', 'other'); setShowCustomBag(true) }}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              feedBag === 'other'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            Other
          </button>
        </div>
        {showCustomBag && (
          <div className="flex items-center gap-2">
            <input
              {...form.register('feedBagCustom')}
              type="number"
              inputMode="decimal"
              min="1"
              className="input-base flex-1"
              placeholder="Enter kg"
            />
            <span className="text-sm text-gray-500 flex-shrink-0">kg</span>
          </div>
        )}
      </div>

      {/* Currency */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
        <select {...form.register('currency')} className="input-base">
          {CURRENCIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Daily reminder */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Daily data entry reminder
        </label>
        <p className="text-xs text-gray-500 mb-2">Remind me to enter records at:</p>
        <input
          {...form.register('reminderTime')}
          type="time"
          className="input-base"
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Language</label>
        <select {...form.register('language')} className="input-base">
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </div>
    </form>
  )
})

Step4Settings.displayName = 'Step4Settings'
