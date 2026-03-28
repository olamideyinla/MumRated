import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

export interface PieDataPoint {
  name: string
  value: number
  color?: string
}

const DEFAULT_COLORS = [
  '#2D6A4F', '#52b788', '#DAA520', '#f97316', '#8B6914',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ef4444',
]

interface CostBreakdownPieProps {
  data: PieDataPoint[]
  height?: number
  emptyText?: string
  currency?: string
}

export function CostBreakdownPie({
  data,
  height = 220,
  emptyText = 'No cost data yet',
  currency = '',
}: CostBreakdownPieProps) {
  const filtered = data.filter(d => d.value > 0)

  if (!filtered || filtered.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-400 text-xs text-center px-4">
        {emptyText}
      </div>
    )
  }

  const total = filtered.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive
          animationDuration={600}
        >
          {filtered.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
          formatter={(value: number, name: string) => [
            `${currency}${value.toLocaleString()} (${Math.round((value / total) * 100)}%)`,
            name,
          ]}
        />
        <Legend
          iconSize={10}
          iconType="circle"
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value, entry) => {
            const pct = Math.round(((entry.payload as PieDataPoint).value / total) * 100)
            return `${value} ${pct}%`
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
