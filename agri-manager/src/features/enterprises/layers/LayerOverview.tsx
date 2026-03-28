import { useLayerMetrics } from '../hooks/use-layer-metrics'
import { KPICard } from '../../../shared/components/charts/KPICard'
import { ProductionCurveChart } from '../../../shared/components/charts/ProductionCurveChart'
import { TrendLineChart } from '../../../shared/components/charts/TrendLineChart'
import type { EnterpriseInstance } from '../../../shared/types'

interface Props { enterprise: EnterpriseInstance }

export function LayerOverview({ enterprise }: Props) {
  const metrics = useLayerMetrics(
    enterprise.id,
    enterprise.startDate,
    enterprise.currentStockCount,
    enterprise.initialStockCount,
  )

  if (metrics === undefined) {
    return <div className="p-4 text-sm text-gray-400">Loading…</div>
  }

  const hdpVariant = metrics.currentHdpPct >= 75 ? 'good' : metrics.currentHdpPct >= 55 ? 'warning' : 'danger'
  const mortVariant = metrics.cumulativeMortPct < 2 ? 'good' : metrics.cumulativeMortPct < 5 ? 'warning' : 'danger'
  const currentWeek = Math.ceil(metrics.dayOfCycle / 7)

  return (
    <div className="space-y-4 p-4">
      {/* KPI row */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Metrics</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <KPICard
            label="Production"
            value={`${metrics.currentHdpPct}%`}
            subValue="Hen-day"
            trend={metrics.hdpTrend7d}
            trendLabel={metrics.hdpTrend7d != null ? `${metrics.hdpTrend7d > 0 ? '+' : ''}${metrics.hdpTrend7d}pts` : undefined}
            variant={hdpVariant}
          />
          <KPICard
            label="Cumulative Mort."
            value={`${metrics.cumulativeMortPct}%`}
            subValue={`${metrics.totalEggs.toLocaleString()} total eggs`}
            variant={mortVariant}
          />
          <KPICard
            label="Total Feed"
            value={`${metrics.totalFeedKg} kg`}
            subValue={`Day ${metrics.dayOfCycle}`}
            variant="default"
          />
          <KPICard
            label="Flock Size"
            value={enterprise.currentStockCount.toLocaleString()}
            subValue={`of ${enterprise.initialStockCount.toLocaleString()}`}
            variant="default"
          />
        </div>
      </div>

      {/* Production curve */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Production Curve vs Standard</p>
        <ProductionCurveChart
          data={metrics.weeklyProduction}
          currentWeek={currentWeek}
          height={200}
        />
      </div>

      {/* Weekly mortality */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Weekly Mortality</p>
        <TrendLineChart
          data={metrics.weeklyMortality}
          label="Deaths"
          color="#ef4444"
          height={140}
          showGrid
          emptyText="No mortality data yet"
        />
      </div>

      {/* Feed trend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Daily Feed (last 30 days)</p>
        <TrendLineChart
          data={metrics.dailyFeed}
          label="Feed"
          unit=" kg"
          color="#8B6914"
          height={130}
          emptyText="No feed data yet"
        />
      </div>
    </div>
  )
}
