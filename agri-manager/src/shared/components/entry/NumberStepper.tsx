import { Minus, Plus } from 'lucide-react'

interface NumberStepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  size?: 'sm' | 'md'
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  size = 'md',
}: NumberStepperProps) {
  const dec = () => onChange(Math.max(min, value - step))
  const inc = () => onChange(Math.min(max, value + step))

  const btnCls = size === 'md'
    ? 'w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform'
    : 'w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-transform'

  const valCls = size === 'md'
    ? 'text-4xl font-bold w-24 text-center text-gray-900'
    : 'text-2xl font-bold w-16 text-center text-gray-900'

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className={`${btnCls} bg-gray-100 text-gray-600 disabled:opacity-30`}
        aria-label="Decrease"
      >
        <Minus size={size === 'md' ? 22 : 18} />
      </button>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        className={`${valCls} bg-transparent border-b-2 border-primary-400 focus:outline-none focus:border-primary-600`}
      />

      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className={`${btnCls} bg-primary-500 text-white disabled:opacity-30`}
        aria-label="Increase"
      >
        <Plus size={size === 'md' ? 22 : 18} />
      </button>
    </div>
  )
}
