// Legacy hooks (preserved for backward compatibility)
export { useCurrentOrg } from './useCurrentOrg'
export { useEnterprises } from './useEnterprises'
export { useAlerts, useUnreadHighCriticalCount } from './useAlerts'

// Enterprise hooks
export {
  useActiveEnterprises,
  useEnterprise,
  useEnterprisesByType,
  useEnterprisesByLocation,
} from './use-enterprises'

// Daily record hooks
export {
  useRecordsForEnterprise,
  useLatestRecord,
  useTodayEntryStatus,
  useWeeklySummary,
  type AnyDailyRecord,
  type DateRange,
  type TodayEntryStatus,
  type WeeklySummary,
} from './use-daily-records'

// Inventory hooks
export {
  useInventoryItems,
  useLowStockItems,
  useItemTransactions,
} from './use-inventory'

// Financial hooks
export {
  useMonthlyFinancials,
  useEnterpriseFinancials,
  useExpensesByCategory,
  type MonthlyFinancials,
} from './use-financials'
