interface RunningTotalProps {
  label: string
  value: string | number
  subLabel?: string
  variant?: 'default' | 'warning' | 'danger' | 'success'
}

const VARIANT_CLASSES = {
  default: 'bg-gray-100 text-gray-600',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
}

export function RunningTotal({ label, value, subLabel, variant = 'default' }: RunningTotalProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {label}: {value}{subLabel && <span className="opacity-70">{subLabel}</span>}
    </span>
  )
}
