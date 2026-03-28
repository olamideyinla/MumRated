import { useFishMetrics } from '../hooks/use-fish-metrics'
import { KPICard } from '../../../shared/components/charts/KPICard'
import { TrendLineChart } from '../../../shared/components/charts/TrendLineChart'
import { WaterQualityGauge, WQ_ZONES } from '../../../shared/components/charts/WaterQualityGauge'
import type { EnterpriseInstance } from '../../../shared/types'

interface Props { enterprise: EnterpriseInstance }

export function FishOverview({ enterprise }: Props) {
  const metrics = useFishMetrics(
    enterprise.id,
    enterprise.startDate,
    enterprise.currentStockCount,
    enterprise.initialStockCount,
  )

  if (metrics === undefined) {
    return <div className="p-4 text-sm text-gray-400">Loading…</div>
  }

  const survivalVariant = metrics.survivalPct >= 90 ? 'good' : metrics.survivalPct >= 75 ? 'warning' : 'danger'

  return (
    <div className="space-y-4 p-4">
      {/* KPI row */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Metrics</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <KPICard
            label="Days Stocked"
            value={String(metrics.daysSinceStocking)}
            subValue="days"
            variant="default"
          />
          <KPICard
            label="Survival"
            value={`${metrics.survivalPct}%`}
            subValue={`${enterprise.currentStockCount.toLocaleString()} fish`}
            variant={survivalVariant}
          />
          <KPICard
            label="Est. Biomass"
            value={metrics.estimatedBiomassKg != null ? `${metrics.estimatedBiomassKg} kg` : '—'}
            variant="default"
          />
          <KPICard
            label="FCR"
            value={metrics.fcr > 0 ? String(metrics.fcr) : '—'}
            subValue="feed:gain"
            variant={metrics.fcr > 0 && metrics.fcr < 1.8 ? 'good' : metrics.fcr > 2.5 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* Water quality gauges */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Water Quality</p>
          {metrics.latestWQ && (
            <p className="text-xs text-gray-400">Last: {metrics.latestWQ.date}</p>
          )}
        </div>
        {metrics.latestWQ ? (
          <div className="grid grid-cols-4 gap-2">
            <WaterQualityGauge
              label="Temp"
              value={metrics.latestWQ.waterTemp}
              unit="°C"
              min={15} max={38}
              zones={WQ_ZONES.temperature()}
              size={72}
            />
            <WaterQualityGauge
              label="pH"
              value={metrics.latestWQ.waterPh}
              unit="pH"
              min={5} max={10}
              zones={WQ_ZONES.ph()}
              size={72}
            />
            <WaterQualityGauge
              label="DO"
              value={metrics.latestWQ.dissolvedOxygen}
              unit="mg/L"
              min={0} max={14}
              zones={WQ_ZONES.dissolvedOxygen()}
              size={72}
            />
            <WaterQualityGauge
              label="NH₃"
              value={metrics.latestWQ.ammonia != null ? metrics.latestWQ.ammonia * 100 : undefined}
              unit="×0.01"
              min={0} max={100}
              zones={WQ_ZONES.ammonia(0, 1).map(z => ({ ...z, from: z.from * 100, to: z.to * 100 }))}
              size={72}
            />
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">
            Record water quality readings in daily entries
          </p>
        )}
      </div>

      {/* Feed history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Feed History (last 30 days)</p>
        <TrendLineChart
          data={metrics.feedHistory}
          label="Feed"
          unit=" kg"
          color="#3b82f6"
          height={140}
          emptyText="No feed data yet"
        />
      </div>
    </div>
  )
}
