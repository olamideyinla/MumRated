import Dexie, { type EntityTable } from 'dexie'
import type {
  Organization, FarmLocation, Infrastructure, EnterpriseInstance,
  LayerDailyRecord, BroilerDailyRecord, CattleDailyRecord,
  FishDailyRecord, CropActivityRecord,
  PigDailyRecord, RabbitDailyRecord, CustomAnimalDailyRecord,
  InventoryItem, InventoryTransaction, FinancialTransaction,
  Contact, AppUser, Alert,
  HealthProtocol, ScheduledHealthEvent,
  Worker, AttendanceRecord, CasualLaborEntry, PayrollEntry,
  DailyTaskChecklist, DailyTask, ReminderSchedule, TaskTemplate,
} from '../../shared/types'
import type { ConflictRecord } from '../sync/conflict-resolver'

// ── AuditRecord ───────────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string
  userId: string
  userFullName: string
  action: 'create' | 'update' | 'delete'
  tableName: string
  recordId: string
  /** JSON-stringified diff: { fieldName: { old, new } } for update, full record for create/delete */
  changes: string
  enterpriseInstanceId?: string
  timestamp: string  // ISO 8601
}

export interface SyncMeta {
  tableName: string
  lastSyncedAt: string  // ISO 8601
}

export class AgriDatabase extends Dexie {
  organizations!: EntityTable<Organization, 'id'>
  farmLocations!: EntityTable<FarmLocation, 'id'>
  infrastructures!: EntityTable<Infrastructure, 'id'>
  enterpriseInstances!: EntityTable<EnterpriseInstance, 'id'>
  layerDailyRecords!: EntityTable<LayerDailyRecord, 'id'>
  broilerDailyRecords!: EntityTable<BroilerDailyRecord, 'id'>
  cattleDailyRecords!: EntityTable<CattleDailyRecord, 'id'>
  fishDailyRecords!: EntityTable<FishDailyRecord, 'id'>
  cropActivityRecords!: EntityTable<CropActivityRecord, 'id'>
  pigDailyRecords!: EntityTable<PigDailyRecord, 'id'>
  rabbitDailyRecords!: EntityTable<RabbitDailyRecord, 'id'>
  customAnimalDailyRecords!: EntityTable<CustomAnimalDailyRecord, 'id'>
  inventoryItems!: EntityTable<InventoryItem, 'id'>
  inventoryTransactions!: EntityTable<InventoryTransaction, 'id'>
  financialTransactions!: EntityTable<FinancialTransaction, 'id'>
  contacts!: EntityTable<Contact, 'id'>
  appUsers!: EntityTable<AppUser, 'id'>
  alerts!: EntityTable<Alert, 'id'>
  conflicts!: EntityTable<ConflictRecord, 'id'>
  auditLog!: EntityTable<AuditRecord, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'tableName'>
  healthProtocols!: EntityTable<HealthProtocol, 'id'>
  scheduledHealthEvents!: EntityTable<ScheduledHealthEvent, 'id'>
  workers!: EntityTable<Worker, 'id'>
  attendanceRecords!: EntityTable<AttendanceRecord, 'id'>
  casualLaborEntries!: EntityTable<CasualLaborEntry, 'id'>
  payrollEntries!: EntityTable<PayrollEntry, 'id'>
  dailyTaskChecklists!: EntityTable<DailyTaskChecklist, 'id'>
  dailyTasks!: EntityTable<DailyTask, 'id'>
  reminderSchedules!: EntityTable<ReminderSchedule, 'id'>
  taskTemplates!: EntityTable<TaskTemplate, 'id'>

  constructor() {
    super('agri-manager-db')

    this.version(1).stores({
      organizations:
        '&id',
      farmLocations:
        '&id, organizationId',
      infrastructures:
        '&id, farmLocationId, status',
      enterpriseInstances:
        '&id, infrastructureId, enterpriseType, status, startDate',
      // Compound index [enterpriseInstanceId+date] is the primary query pattern
      layerDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
      broilerDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
      cattleDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
      fishDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
      cropActivityRecords:
        '&id, enterpriseInstanceId, date, syncStatus',
      inventoryItems:
        '&id, organizationId, category',
      inventoryTransactions:
        '&id, inventoryItemId, type, date, enterpriseInstanceId',
      financialTransactions:
        '&id, organizationId, type, category, date, enterpriseInstanceId',
      contacts:
        '&id, organizationId, type',
      appUsers:
        '&id, organizationId, role',
      alerts:
        '&id, severity, isRead, enterpriseInstanceId, createdAt',
      syncMeta:
        '&tableName',
    })

    // v2 — adds pig, rabbit and custom animal daily record tables
    this.version(2).stores({
      pigDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
      rabbitDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
      customAnimalDailyRecords:
        '&id, enterpriseInstanceId, date, [enterpriseInstanceId+date], syncStatus',
    })

    // v3 — adds conflicts table for sync conflict resolution
    this.version(3).stores({
      conflicts: '&id, tableName, recordId, resolved',
    })

    // v4 — adds auditLog table for user activity tracking
    this.version(4).stores({
      auditLog: '&id, userId, action, tableName, enterpriseInstanceId, timestamp',
    })

    // v5 — adds createdAt index to alerts (required for orderBy queries)
    this.version(5).stores({
      alerts: '&id, severity, isRead, enterpriseInstanceId, createdAt',
    })

    // v6 — adds health protocols and scheduled events tables
    this.version(6).stores({
      healthProtocols: '&id, organizationId, enterpriseType',
      scheduledHealthEvents: '&id, enterpriseInstanceId, scheduledDate, status, syncStatus',
    })

    // v7 — adds labor management tables
    this.version(7).stores({
      workers: '&id, organizationId, workerType, status',
      attendanceRecords: '&id, workerId, date, [workerId+date], syncStatus',
      casualLaborEntries: '&id, organizationId, date, enterpriseInstanceId, syncStatus',
      payrollEntries: '&id, workerId, periodStart, status, syncStatus',
    })

    // v8 — adds worker daily task checklist + reminder + task template tables
    this.version(8).stores({
      dailyTaskChecklists: '&id, workerId, date, [workerId+date]',
      dailyTasks: '&id, checklistId, type, status, enterpriseInstanceId, [checklistId+status]',
      reminderSchedules: '&id, organizationId, role, reminderType',
      taskTemplates: '&id, organizationId, isActive, infrastructureId',
    })
  }
}

export const db = new AgriDatabase()
