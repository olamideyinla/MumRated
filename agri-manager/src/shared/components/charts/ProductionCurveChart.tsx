import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts'

// ── Lohmann Brown standard HDP% by week of age ────────────────────────────────

const LB_POINTS: [number, number][] = [
  [18, 5], [19, 40], [20, 72], [21, 87], [22, 91], [23, 92], [24, 92],
  [28, 91], [32, 89], [36, 87], [40, 85], [44, 83], [48, 81],
  [52, 79], [56, 77], [60, 74], [64, 71], [68, 68], [72, 64],
]

function lbForWeek(week: number): number {
  if (week <= LB_POINTS[0][0]) return LB_POINTS[0][1]
  if (week >= LB_POINTS[LB_POINTS.length - 1][0]) return LB_POINTS[LB_POINTS.length - 1][1]
  for (let i = 1; i < LB_POINTS.length; i++) {
    const [d0, w0] = LB_POINTS[i - 1]
    const [d1, w1] = LB_POINTS[i]
    if (week <= d1) {
      const t = (week - d0) / (d1 - d0)
      return Math.round((w0 + t * (w1 - w0)) * 10) / 10
    }
  }
  return LB_POINTS[LB_POINTS.length - 1][1]
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ProductionDataPoint {
  week: number
  actual?: number | null
}

interface ProductionCurveChartProps {
  data: ProductionDataPoint[]
  currentWeek?: number
  height?: number
  emptyText?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductionCurveChart({
  data,
  currentWeek,
  height = 200,
  emptyText = 'Start entering data to see your production curve',
}: ProductionCurveChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-400 text-xs text-center px-4">
        {emptyText}
      </div>
    )
  }

  // Merge actual + standard across the full range
  const minWeek = Math.min(...data.map(d => d.week), 18)
  const maxWeek = Math.max(...data.map(d => d.week), 24)
  const allWeeks = Array.from({ length: maxWeek - minWeek + 1 }, (_, i) => minWeek + i)

  const actualMap = new Map(data.map(d => [d.week, d.actual ?? null]))

  const chartData = allWeeks.map(week => ({
    week,
    actual: actualMap.get(week) ?? null,
    standard: lbForWeek(week),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Week', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9ca3af' }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          unit="%"
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
          formatter={(v: number, name: string) => [
            v != null ? `${v}%` : '—',
            name === 'actual' ? 'Actual' : 'LB Standard',
          ]}
          labelFormatter={(label) => `Week ${label}`}
        />
        <Legend
          iconType="line"
          iconSize={14}
          formatter={(value) => value === 'actual' ? 'Actual' : 'LB Standard'}
          wrapperStyle={{ fontSize: 11 }}
        />
        {currentWeek != null && (
          <ReferenceLine x={currentWeek} stroke="#2D6A4F" strokeDasharray="4 2" strokeWidth={1.5} />
        )}
        {/* Standard: dashed gray */}
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
        {/* Actual: solid green */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#2D6A4F"
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
