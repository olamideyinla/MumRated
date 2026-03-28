import { useState } from 'react'
import { useAvailableBatches, useComparisonData } from '../hooks/use-enterprise-comparison'
import { ComparisonBarChart } from '../../../shared/components/charts/ComparisonBarChart'
import type { EnterpriseInstance, EnterpriseType } from '../../../shared/types'

// ── KPI extraction per type ───────────────────────────────────────────────────

interface KpiRow {
  label: string
  current: number
  compared: number
  unit: string
  higherIsBetter: boolean
}

function extractKpis(
  type: EnterpriseType,
  currentRecs: any[],
  comparedRecs: any[],
): KpiRow[] {
  const avg = (arr: any[], key: string) =>
    arr.length > 0 ? Math.round((arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length) * 10) / 10 : 0

  const sum = (arr: any[], key: string) => Math.round(arr.reduce((s, r) => s + (r[key] ?? 0), 0) * 10) / 10

  switch (type) {
    case 'layers': return [
      { label: 'Avg Daily Eggs', current: avg(currentRecs, 'totalEggs'), compared: avg(comparedRecs, 'totalEggs'), unit: '', higherIsBetter: true },
      { label: 'Total Eggs', current: sum(currentRecs, 'totalEggs'), compared: sum(comparedRecs, 'totalEggs'), unit: '', higherIsBetter: true },
      { label: 'Avg Mortality/day', current: avg(currentRecs, 'mortalityCount'), compared: avg(comparedRecs, 'mortalityCount'), unit: '', higherIsBetter: false },
      { label: 'Total Feed (kg)', current: sum(currentRecs, 'feedConsumedKg'), compared: sum(comparedRecs, 'feedConsumedKg'), unit: ' kg', higherIsBetter: false },
    ]
    case 'broilers': return [
      { label: 'Avg Mortality/day', current: avg(currentRecs, 'mortalityCount'), compared: avg(comparedRecs, 'mortalityCount'), unit: '', higherIsBetter: false },
      { label: 'Total Feed (kg)', current: sum(currentRecs, 'feedConsumedKg'), compared: sum(comparedRecs, 'feedConsumedKg'), unit: ' kg', higherIsBetter: false },
    ]
    case 'cattle_dairy': return [
      { label: 'Avg Daily Milk (L)', current: avg(currentRecs, 'milkYieldLiters'), compared: avg(comparedRecs, 'milkYieldLiters'), unit: ' L', higherIsBetter: true },
      { label: 'Total Feed (kg)', current: sum(currentRecs, 'feedConsumedKg'), compared: sum(comparedRecs, 'feedConsumedKg'), unit: ' kg', higherIsBetter: false },
    ]
    case 'fish': return [
      { label: 'Avg Daily Feed (kg)', current: avg(currentRecs, 'feedGivenKg'), compared: avg(comparedRecs, 'feedGivenKg'), unit: ' kg', higherIsBetter: false },
      { label: 'Total Mortality', current: sum(currentRecs, 'estimatedMortality'), compared: sum(comparedRecs, 'estimatedMortality'), unit: '', higherIsBetter: false },
    ]
    default: return [
      { label: 'Total Feed (kg)', current: sum(currentRecs, 'feedConsumedKg'), compared: sum(comparedRecs, 'feedConsumedKg'), unit: ' kg', higherIsBetter: false },
    ]
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { enterprise: EnterpriseInstance }

export function EnterpriseAnalysis({ enterprise }: Props) {
  const [selectedId, setSelectedId] = useState<string>('')

  const batches = useAvailableBatches(
    enterprise.id,
    enterprise.enterpriseType,
    enterprise.infrastructureId,
  )

  const comparison = useComparisonData(
    enterprise.id,
    selectedId || undefined,
    enterprise.enterpriseType,
  )

  const kpis: KpiRow[] = comparison
    ? extractKpis(enterprise.enterpriseType, comparison.currentRecords as any[], comparison.comparedRecords as any[])
    : []

  const barData = kpis.map(k => ({
    label: k.label.split(' ').slice(0, 2).join(' '),
    current: k.current,
    compared: k.compared,
  }))

  return (
    <div className="p-4 space-y-4">
      {/* Comparison selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Compare with</p>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="input-base"
        >
          <option value="">— Select a previous batch —</option>
          {batches?.map(b => (
            <option key={b.enterprise.id} value={b.enterprise.id}>
              {b.label}
            </option>
          ))}
        </select>
        {batches !== undefined && batches.length === 0 && (
          <p className="text-xs text-gray-400 mt-1.5">No previous batches found on this infrastructure</p>
        )}
      </div>

      {selectedId && comparison && comparison.comparedRecords.length > 0 && (
        <>
          {/* KPI comparison table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">KPI Comparison</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-gray-500">Metric</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-primary-700">Current</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">Previous</th>
                    <th className="text-right py-2 pl-2 text-xs font-semibold text-gray-500">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map(row => {
                    const diff = Math.round((row.current - row.compared) * 10) / 10
                    const isGood = row.higherIsBetter ? diff > 0 : diff < 0
                    const diffColor = diff === 0 ? 'text-gray-400' : isGood ? 'text-emerald-600' : 'text-red-500'
                    return (
                      <tr key={row.label} className="border-b border-gray-50">
                        <td className="py-2.5 pr-2 text-xs text-gray-600">{row.label}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-gray-900">{row.current}{row.unit}</td>
                        <td className="py-2.5 px-2 text-right text-gray-500">{row.compared}{row.unit}</td>
                        <td className={`py-2.5 pl-2 text-right font-semibold ${diffColor}`}>
                          {diff > 0 ? '+' : ''}{diff}{row.unit}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar chart comparison */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Side-by-Side Comparison</p>
            <ComparisonBarChart
              data={barData}
              currentLabel="Current"
              comparedLabel={comparison.comparedEnterprise?.name ?? 'Previous'}
              height={180}
            />
          </div>
        </>
      )}

      {selectedId && comparison && comparison.comparedRecords.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-sm text-gray-400 py-6">No records found for the selected batch</p>
        </div>
      )}

      {!selectedId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-sm text-gray-500 font-medium">Select a batch to compare</p>
          <p className="text-xs text-gray-400 mt-1">Compare KPIs side-by-side with a previous cycle</p>
        </div>
      )}
    </div>
  )
}
