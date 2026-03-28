import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  subValue?: string
  /** Positive = good direction, negative = bad direction, null/0 = neutral */
  trend?: number | null
  trendLabel?: string
  variant?: 'default' | 'good' | 'warning' | 'danger'
  onClick?: () => void
  className?: string
}

const VARIANT = {
  default: { card: 'bg-gray-50 border-gray-200',      text: 'text-gray-800', sub: 'text-gray-500' },
  good:    { card: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', sub: 'text-emerald-600' },
  warning: { card: 'bg-amber-50 border-amber-200',     text: 'text-amber-800', sub: 'text-amber-600' },
  danger:  { card: 'bg-red-50 border-red-200',         text: 'text-red-800', sub: 'text-red-600' },
}

export function KPICard({
  label, value, subValue, trend, trendLabel, variant = 'default', onClick, className = '',
}: KPICardProps) {
  const v = VARIANT[variant]
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend == null ? '' : trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-gray-400'

  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-36 rounded-2xl border p-3 ${v.card} ${onClick ? 'active:scale-95 transition-transform cursor-pointer' : ''} ${className}`}
    >
      <p className={`text-xs font-medium truncate ${v.sub}`}>{label}</p>
      <p className={`text-2xl font-bold leading-tight mt-1 ${v.text}`}>{value}</p>
      {subValue && <p className={`text-xs mt-0.5 truncate ${v.sub}`}>{subValue}</p>}
      {TrendIcon && (
        <div className={`flex items-center gap-0.5 mt-1.5 ${trendColor}`}>
          <TrendIcon size={12} />
          {trendLabel && <span className="text-xs font-medium">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
