import type {
  Organization, FarmLocation, Infrastructure, EnterpriseInstance,
  LayerDailyRecord, BroilerDailyRecord, FishDailyRecord,
  InventoryItem, FinancialTransaction, AppUser,
} from '../shared/types'

function now(): string {
  return new Date().toISOString()
}

export function createOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: crypto.randomUUID(),
    name: 'Test Farm Org',
    currency: 'USD',
    defaultUnitSystem: 'metric',
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createFarmLocation(orgId: string, overrides: Partial<FarmLocation> = {}): FarmLocation {
  return {
    id: crypto.randomUUID(),
    organizationId: orgId,
    name: 'Main Farm',
    status: 'active',
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createInfrastructure(locId: string, overrides: Partial<Infrastructure> = {}): Infrastructure {
  return {
    id: crypto.randomUUID(),
    farmLocationId: locId,
    name: 'House A',
    type: 'poultry_house',
    status: 'active',
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createEnterpriseInstance(infraId: string, overrides: Partial<EnterpriseInstance> = {}): EnterpriseInstance {
  return {
    id: crypto.randomUUID(),
    infrastructureId: infraId,
    enterpriseType: 'layers',
    name: 'Batch 2024-A',
    startDate: '2024-01-01',
    status: 'active',
    initialStockCount: 5000,
    currentStockCount: 5000,
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createLayerDailyRecord(entId: string, overrides: Partial<LayerDailyRecord> = {}): LayerDailyRecord {
  return {
    id: crypto.randomUUID(),
    enterpriseInstanceId: entId,
    date: new Date().toISOString().split('T')[0],
    recordedBy: 'test-user',
    totalEggs: 4200,
    mortalityCount: 2,
    feedConsumedKg: 250,
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createBroilerDailyRecord(entId: string, overrides: Partial<BroilerDailyRecord> = {}): BroilerDailyRecord {
  return {
    id: crypto.randomUUID(),
    enterpriseInstanceId: entId,
    date: new Date().toISOString().split('T')[0],
    recordedBy: 'test-user',
    mortalityCount: 5,
    feedConsumedKg: 300,
    bodyWeightSampleAvg: 1.8,
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createFishDailyRecord(entId: string, overrides: Partial<FishDailyRecord> = {}): FishDailyRecord {
  return {
    id: crypto.randomUUID(),
    enterpriseInstanceId: entId,
    date: new Date().toISOString().split('T')[0],
    recordedBy: 'test-user',
    feedGivenKg: 50,
    waterTemp: 27,
    waterPh: 7.2,
    dissolvedOxygen: 6.0,
    ammonia: 0.1,
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createInventoryItem(orgId: string, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: crypto.randomUUID(),
    organizationId: orgId,
    category: 'feed',
    name: 'Layer Feed',
    unitOfMeasurement: 'kg',
    currentStock: 100,
    reorderPoint: 20,
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createFinancialTransaction(orgId: string, overrides: Partial<FinancialTransaction> = {}): FinancialTransaction {
  return {
    id: crypto.randomUUID(),
    organizationId: orgId,
    date: new Date().toISOString().split('T')[0],
    type: 'income',
    category: 'sales_eggs',
    amount: 5000,
    paymentMethod: 'cash',
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createAppUser(orgId: string, userId: string, overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: userId,
    organizationId: orgId,
    fullName: 'Test User',
    role: 'owner',
    assignedFarmLocationIds: [],
    assignedInfrastructureIds: [],
    isActive: true,
    syncStatus: 'synced',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

// Alert factory — uses ruleId and Date for createdAt to match what the engine actually stores
export function createAlert(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    ruleId: 'test_rule',
    severity: 'medium',
    message: 'Test alert',
    isRead: false,
    isDismissed: false,
    createdAt: new Date(),
    syncStatus: 'synced',
    updatedAt: now(),
    ...overrides,
  }
}
