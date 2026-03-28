import type { AlertSeverity, ProductionType, EnterpriseStatus, InventoryCategory } from '../../shared/types'

export function productionTypeLabel(type: ProductionType): string {
  const map: Record<ProductionType, string> = {
    layer: 'Layer Flock',
    broiler: 'Broilers',
    cattle: 'Cattle',
    fish: 'Fish / Aquaculture',
    crop: 'Crops',
  }
  return map[type]
}

export function enterpriseStatusLabel(status: EnterpriseStatus): string {
  const map: Record<EnterpriseStatus, string> = {
    active: 'Active',
    completed: 'Completed',
    suspended: 'Suspended',
  }
  return map[status]
}

export function inventoryCategoryLabel(cat: InventoryCategory): string {
  const map: Record<InventoryCategory, string> = {
    feed: 'Feed',
    medication: 'Medication',
    fertilizer: 'Fertilizer',
    seed: 'Seed',
    chemical: 'Chemical',
    fuel: 'Fuel',
    packaging: 'Packaging',
    produce: 'Produce',
    other: 'Other',
  }
  return map[cat] ?? cat
}

export function alertSeverityLabel(severity: AlertSeverity): string {
  return severity.toUpperCase()
}

export function truncate(str: string, maxLen = 40): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}
