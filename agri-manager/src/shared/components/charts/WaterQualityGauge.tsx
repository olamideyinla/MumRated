/**
 * SVG semi-circle gauge with colored zones and a needle.
 * Shows a single water quality parameter.
 */

interface Zone {
  from: number
  to: number
  color: string
}

interface WaterQualityGaugeProps {
  label: string
  value: number | undefined | null
  unit: string
  min: number
  max: number
  zones: Zone[]  // must cover min → max
  size?: number  // px, default 120
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polarToXY(cx, cy, r, startDeg)
  const e = polarToXY(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
}

function valueToDeg(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value))
  return 180 + ((clamped - min) / (max - min)) * 180
}

// ── Component ────────────────────────────────────────────────────────────────

export function WaterQualityGauge({
  label, value, unit, min, max, zones, size = 120,
}: WaterQualityGaugeProps) {
  const cx = size / 2
  const cy = size * 0.62
  const r  = size * 0.38
  const strokeW = size * 0.12

  // Track arc: 180° → 360° (semi-circle)
  const trackArcs = zones.map(z => ({
    color: z.color,
    d: arcPath(cx, cy, r, valueToDeg(z.from, min, max), valueToDeg(z.to, min, max)),
  }))

  // Needle
  const needleDeg  = value != null ? valueToDeg(value, min, max) : 180
  const needleTip  = polarToXY(cx, cy, r - strokeW * 0.3, needleDeg)
  const needleBase = polarToXY(cx, cy, strokeW * 0.3, needleDeg + 90)
  const needleBase2 = polarToXY(cx, cy, strokeW * 0.3, needleDeg - 90)

  // Indicator color from zones
  let indicatorColor = '#6b7280'
  if (value != null) {
    for (const z of zones) {
      if (value >= z.from && value <= z.to) { indicatorColor = z.color; break }
    }
  }

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={cy + 8} viewBox={`0 0 ${size} ${cy + 8}`}>
        {/* Track arcs */}
        {trackArcs.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            stroke={arc.color}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}
        {/* Needle */}
        {value != null && (
          <>
            <polygon
              points={`${needleTip.x},${needleTip.y} ${needleBase.x},${needleBase.y} ${needleBase2.x},${needleBase2.y}`}
              fill="#374151"
              opacity={0.9}
            />
            <circle cx={cx} cy={cy} r={strokeW * 0.35} fill="#374151" />
          </>
        )}
        {/* Center value */}
        <text
          x={cx}
          y={cy - strokeW * 0.3}
          textAnchor="middle"
          fontSize={size * 0.175}
          fontWeight="bold"
          fill={indicatorColor}
        >
          {value != null ? value : '—'}
        </text>
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={size * 0.1}
          fill="#9ca3af"
        >
          {unit}
        </text>
      </svg>
      <p className="text-xs font-medium text-gray-600 mt-0.5 text-center leading-tight">{label}</p>
    </div>
  )
}

// ── Preset zone configs ──────────────────────────────────────────────────────

export const WQ_ZONES = {
  temperature: (min = 15, max = 38): Zone[] => [
    { from: min,  to: 18,   color: '#3b82f6' },
    { from: 18,   to: 22,   color: '#f59e0b' },
    { from: 22,   to: 30,   color: '#22c55e' },
    { from: 30,   to: 34,   color: '#f59e0b' },
    { from: 34,   to: max,  color: '#ef4444' },
  ],
  ph: (min = 5, max = 10): Zone[] => [
    { from: min,  to: 6,    color: '#ef4444' },
    { from: 6,    to: 6.5,  color: '#f59e0b' },
    { from: 6.5,  to: 8.5,  color: '#22c55e' },
    { from: 8.5,  to: 9,    color: '#f59e0b' },
    { from: 9,    to: max,  color: '#ef4444' },
  ],
  dissolvedOxygen: (min = 0, max = 14): Zone[] => [
    { from: min,  to: 3,    color: '#ef4444' },
    { from: 3,    to: 5,    color: '#f59e0b' },
    { from: 5,    to: max,  color: '#22c55e' },
  ],
  ammonia: (min = 0, max = 1): Zone[] => [
    { from: min,  to: 0.02, color: '#22c55e' },
    { from: 0.02, to: 0.1,  color: '#f59e0b' },
    { from: 0.1,  to: max,  color: '#ef4444' },
  ],
}
