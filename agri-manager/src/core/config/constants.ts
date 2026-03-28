export const APP_NAME = 'AgriManagerX'
export const APP_VERSION = '1.0.0'

export const DB_NAME = 'agri-manager-db'
export const DB_VERSION = 1

// Alert rule IDs
export const AlertRuleId = {
  layerProductionDrop: 'layer_production_drop',
  layerMortalitySpike: 'layer_mortality_spike',
  layerFeedAnomaly: 'layer_feed_anomaly',
  broilerMortalitySpike: 'broiler_mortality_spike',
  broilerWeightBehind: 'broiler_weight_behind',
  broilerNearMarket: 'broiler_near_market',
  fishDoCritical: 'fish_do_critical',
  fishAmmoniaHigh: 'fish_ammonia_high',
  fishPhOutOfRange: 'fish_ph_out_of_range',
  fishTempExtreme: 'fish_temp_extreme',
  invLowStock: (itemId: string) => `inv_low_stock_${itemId}`,
  invProjectedStockout: (itemId: string) => `inv_projected_stockout_${itemId}`,
  opNoData: (enterpriseId: string) => `op_no_data_${enterpriseId}`,
  opBatchNearingEnd: (enterpriseId: string) => `op_batch_nearing_end_${enterpriseId}`,
  finCostExceedingRevenue: 'fin_cost_exceeding_revenue',
} as const

// Alert thresholds
export const AlertThresholds = {
  layerProductionDropPts: 3.0,
  layerMinHdpForDrop: 60.0,
  layerMortalityMinBirds: 3,
  layerMortalityPct: 0.001, // 0.1%
  layerFeedDeviationPct: 0.20,
  broilerMortalityMinBirds: 3,
  broilerMortalityPct: 0.0015, // 0.15%
  broilerWeightBehindPct: 0.10,
  broilerNearMarketDays: 5,
  fishDoLow: 3.0,
  fishAmmoniaHigh: 0.5,
  fishPhMin: 6.5,
  fishPhMax: 9.0,
  fishTempMin: 18,
  fishTempMax: 32,
  invProjectedStockoutDays: 5,
  opMissingDataAfterHour: 18,
  opBatchNearingEndDays: 7,
  finCostPct: 0.90,
  defaultDedupHours: 24,
  longTermDedupHours: 168,
} as const

// Ross 308 standard weights by day (kg)
export const Ross308WeightKg: Record<number, number> = {
  0: 0.042, 7: 0.190, 14: 0.430, 21: 0.820, 28: 1.350, 35: 1.900, 42: 2.500,
}
