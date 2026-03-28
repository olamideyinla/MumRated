import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

export interface ComparisonDataPoint {
  label: string
  current: number
  compared: number
}

interface ComparisonBarChartProps {
  data: ComparisonDataPoint[]
  currentLabel?: string
  comparedLabel?: string
  unit?: string
  height?: number
  emptyText?: string
}

export function ComparisonBarChart({
  data,
  currentLabel = 'Current',
  comparedLabel = 'Compared',
  unit = '',
  height = 180,
  emptyText = 'No comparison data available',
}: ComparisonBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-400 text-xs text-center px-4">
        {emptyText}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} animationDuration={800}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          unit={unit}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
          formatter={(v: number, name: string) => [`${v}${unit}`, name]}
        />
        <Legend iconSize={12} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="current" name={currentLabel} fill="#2D6A4F" radius={[4, 4, 0, 0]} />
        <Bar dataKey="compared" name={comparedLabel} fill="#9ca3af" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
