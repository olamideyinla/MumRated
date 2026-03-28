// ── Sync table configuration ──────────────────────────────────────────────────

/** Order matters: parent tables must be pushed before child tables. */
export const SYNC_ORDER = [
  'organizations',
  'farmLocations',
  'infrastructures',
  'enterpriseInstances',
  'layerDailyRecords',
  'broilerDailyRecords',
  'cattleDailyRecords',
  'fishDailyRecords',
  'pigDailyRecords',
  'rabbitDailyRecords',
  'customAnimalDailyRecords',
  'cropActivityRecords',
  'inventoryItems',
  'inventoryTransactions',
  'financialTransactions',
  'contacts',
  'appUsers',
] as const

export type SyncTableName = typeof SYNC_ORDER[number]

/** Dexie table name → Supabase table name (snake_case). */
export const TABLE_SUPABASE_NAME: Record<SyncTableName, string> = {
  organizations: 'organizations',
  farmLocations: 'farm_locations',
  infrastructures: 'infrastructures',
  enterpriseInstances: 'enterprise_instances',
  layerDailyRecords: 'layer_daily_records',
  broilerDailyRecords: 'broiler_daily_records',
  cattleDailyRecords: 'cattle_daily_records',
  fishDailyRecords: 'fish_daily_records',
  pigDailyRecords: 'pig_daily_records',
  rabbitDailyRecords: 'rabbit_daily_records',
  customAnimalDailyRecords: 'custom_animal_daily_records',
  cropActivityRecords: 'crop_activity_records',
  inventoryItems: 'inventory_items',
  inventoryTransactions: 'inventory_transactions',
  financialTransactions: 'financial_transactions',
  contacts: 'contacts',
  appUsers: 'app_users',
}

/**
 * Fields to strip from the payload before sending to Supabase.
 * `syncStatus` is always excluded (client-only field).
 */
export const CLIENT_ONLY_FIELDS = new Set(['syncStatus'])

// ── Key transformers ──────────────────────────────────────────────────────────

/** Convert a camelCase string to snake_case. */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/** Convert a snake_case string to camelCase. */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Transform all keys of an object from camelCase → snake_case,
 * stripping any client-only fields.
 */
export function toSupabaseRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (CLIENT_ONLY_FIELDS.has(key)) continue
    out[camelToSnake(key)] = value
  }
  return out
}

/**
 * Transform all keys of an object from snake_case → camelCase.
 */
export function fromSupabaseRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    out[snakeToCamel(key)] = value
  }
  return out
}

/** Tables that have a `syncStatus` Dexie index (use `.where()` for efficiency). */
export const INDEXED_SYNC_STATUS_TABLES = new Set<SyncTableName>([
  'layerDailyRecords',
  'broilerDailyRecords',
  'cattleDailyRecords',
  'fishDailyRecords',
  'pigDailyRecords',
  'rabbitDailyRecords',
  'customAnimalDailyRecords',
  'cropActivityRecords',
])
