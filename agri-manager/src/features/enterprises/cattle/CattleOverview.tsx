import { useCattleMetrics } from '../hooks/use-cattle-metrics'
import { KPICard } from '../../../shared/components/charts/KPICard'
import { TrendLineChart } from '../../../shared/components/charts/TrendLineChart'
import type { EnterpriseInstance } from '../../../shared/types'

interface Props { enterprise: EnterpriseInstance }

export function CattleOverview({ enterprise }: Props) {
  const metrics = useCattleMetrics(
    enterprise.id,
    enterprise.enterpriseType,
    enterprise.currentStockCount,
  )

  if (metrics === undefined) {
    return <div className="p-4 text-sm text-gray-400">Loading…</div>
  }

  return (
    <div className="space-y-4 p-4">
      {/* KPI row */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Metrics</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {metrics.isDairy && (
            <>
              <KPICard
                label="Today's Milk"
                value={`${metrics.totalMilkToday} L`}
                subValue="total yield"
                variant={metrics.totalMilkToday > 0 ? 'good' : 'default'}
              />
              <KPICard
                label="Avg / Cow"
                value={metrics.avgMilkPerCow > 0 ? `${metrics.avgMilkPerCow} L` : '—'}
                subValue="per milking cow"
                variant="default"
              />
              <KPICard
                label="This Month"
                value={`${metrics.totalMilkThisMonth} L`}
                subValue="total milk"
                variant="default"
              />
            </>
          )}
          <KPICard
            label="Herd Size"
            value={metrics.herdCount.toLocaleString()}
            subValue="animals"
            variant="default"
          />
          <KPICard
            label="Births"
            value={String(metrics.birthsThisMonth)}
            subValue="this month"
            variant={metrics.birthsThisMonth > 0 ? 'good' : 'default'}
          />
          <KPICard
            label="Deaths"
            value={String(metrics.deathsThisMonth)}
            subValue="this month"
            variant={metrics.deathsThisMonth === 0 ? 'good' : metrics.deathsThisMonth <= 2 ? 'warning' : 'danger'}
          />
        </div>
      </div>

      {/* Milk trend (dairy only) */}
      {metrics.isDairy && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Milk Production (last 30 days)</p>
          <TrendLineChart
            data={metrics.milkTrend30d}
            label="Milk"
            unit=" L"
            color="#6366f1"
            height={160}
            showGrid
            emptyText="No milk data recorded yet"
          />
        </div>
      )}

      {/* Herd summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Herd Summary</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Current Herd', value: metrics.herdCount.toLocaleString(), color: 'text-gray-800' },
            { label: 'Births (month)', value: String(metrics.birthsThisMonth), color: 'text-emerald-600' },
            { label: 'Deaths (month)', value: String(metrics.deathsThisMonth), color: metrics.deathsThisMonth > 0 ? 'text-red-500' : 'text-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
