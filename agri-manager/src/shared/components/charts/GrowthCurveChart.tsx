import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend,
} from 'recharts'
import { ross308WeightForDay } from '../../../core/services/kpi-calculator'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GrowthDataPoint {
  day: number
  actualKg?: number | null
}

interface GrowthCurveChartProps {
  data: GrowthDataPoint[]
  height?: number
  emptyText?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GrowthCurveChart({
  data,
  height = 200,
  emptyText = 'Start entering weight samples to see your growth curve',
}: GrowthCurveChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-400 text-xs text-center px-4">
        {emptyText}
      </div>
    )
  }

  const maxDay = Math.max(...data.map(d => d.day), 42)
  const allDays = Array.from({ length: maxDay + 1 }, (_, i) => i)

  const actualMap = new Map(data.map(d => [d.day, d.actualKg ?? null]))

  const chartData = allDays.map(day => ({
    day,
    actual:   actualMap.get(day) ?? null,
    standard: ross308WeightForDay(day),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Day', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9ca3af' }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          unit=" kg"
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
          formatter={(v: number, name: string) => [
            v != null ? `${v} kg` : '—',
            name === 'actual' ? 'Actual' : 'Ross 308',
          ]}
          labelFormatter={(label) => `Day ${label}`}
        />
        <Legend
          iconType="line"
          iconSize={14}
          formatter={(value) => value === 'actual' ? 'Actual' : 'Ross 308'}
          wrapperStyle={{ fontSize: 11 }}
        />
        {/* Ross 308 standard: dashed gray */}
        <Line
          type="monotone"
          dataKey="standard"
          stroke="#9ca3af"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          connectNulls
          isAnimationActive={false}
          legendType="line"
        />
        {/* Actual weight: solid orange */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#f97316"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
          isAnimationActive
          animationDuration={600}
          legendType="line"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
