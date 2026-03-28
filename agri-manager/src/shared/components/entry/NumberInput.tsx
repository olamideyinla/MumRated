import type { InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string
  unit?: string
  helperText?: string
  error?: string
  value: string
  onChange: (v: string) => void
  isDecimal?: boolean
}

export function NumberInput({
  label,
  unit,
  helperText,
  error,
  value,
  onChange,
  isDecimal,
  className,
  ...props
}: NumberInputProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          inputMode={isDecimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input-base text-lg font-semibold ${unit ? 'pr-14' : ''}`}
          {...props}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {helperText && !error && (
        <p className="mt-1 text-xs text-gray-400">{helperText}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
