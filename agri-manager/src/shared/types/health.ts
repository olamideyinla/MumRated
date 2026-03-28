export type HealthEventType = 'vaccination' | 'treatment' | 'deworming' | 'vitamin' | 'test' | 'inspection' | 'other'
export type HealthEventStatus = 'upcoming' | 'due_today' | 'overdue' | 'completed' | 'skipped'

export interface HealthProtocolEvent {
  id: string
  name: string
  eventType: HealthEventType
  dayOffset: number
  product?: string
  dosage?: string
  route?: string
  notes?: string
}

export interface HealthProtocol {
  id: string
  organizationId: string
  name: string
  enterpriseType: string
  events: HealthProtocolEvent[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ScheduledHealthEvent {
  id: string
  enterpriseInstanceId: string
  protocolId?: string
  protocolEventId?: string
  name: string
  eventType: HealthEventType
  scheduledDate: string   // YYYY-MM-DD
  status: HealthEventStatus
  product?: string
  dosage?: string
  route?: string
  completedDate?: string
  completedBy?: string
  batchNumber?: string
  notes?: string
  syncStatus: 'pending' | 'synced' | 'error'
  createdAt: string
  updatedAt: string
}
