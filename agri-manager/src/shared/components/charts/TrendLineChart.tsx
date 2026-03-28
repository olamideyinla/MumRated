import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

export interface TrendDataPoint {
  date: string
  value: number
  [key: string]: string | number
}

interface TrendLineChartProps {
  data: TrendDataPoint[]
  label?: string
  unit?: string
  color?: string
  height?: number
  emptyText?: string
  showGrid?: boolean
  domain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax']
}

export function TrendLineChart({
  data,
  label = 'Value',
  unit = '',
  color = '#2D6A4F',
  height = 150,
  emptyText = 'Start entering data to see your trend',
  showGrid = false,
  domain = ['auto', 'auto'],
}: TrendLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-gray-400 text-xs text-center px-4"
      >
        {emptyText}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />}
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          domain={domain}
          unit={unit}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
          formatter={(v: number) => [`${v}${unit}`, label]}
          labelStyle={{ color: '#6b7280', fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
          isAnimationActive
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
