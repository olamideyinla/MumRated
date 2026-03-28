import type { PaymentMethod } from './financial'

export type WorkerType = 'permanent' | 'casual'
export type WageType = 'daily' | 'monthly' | 'hourly' | 'per_piece'
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave'
export type PayrollStatus = 'pending' | 'paid'

export interface Worker {
  id: string
  organizationId: string
  name: string
  phone?: string
  workerType: WorkerType
  wageType: WageType
  wageRate: number
  startDate?: string       // YYYY-MM-DD
  status: 'active' | 'inactive'
  assignedEnterpriseIds: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'conflict'
}

export interface AttendanceRecord {
  id: string
  workerId: string
  date: string             // YYYY-MM-DD
  status: AttendanceStatus
  hoursWorked?: number
  overtimeHours?: number
  notes?: string
  recordedBy: string
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'conflict'
}

export interface CasualLaborEntry {
  id: string
  organizationId: string
  date: string             // YYYY-MM-DD
  enterpriseInstanceId?: string
  activityDescription: string
  numberOfWorkers: number
  hoursPerWorker: number
  ratePerWorker: number
  totalCost: number
  paymentMethod: PaymentMethod
  paid: boolean
  recordedBy: string
  notes?: string
  financialTransactionId?: string
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'conflict'
}

export interface PayrollEntry {
  id: string
  workerId: string
  periodStart: string      // YYYY-MM-DD
  periodEnd: string        // YYYY-MM-DD
  daysWorked: number
  basePay: number
  overtimePay: number
  deductions: number
  netPay: number
  paymentDate?: string
  paymentMethod?: PaymentMethod
  status: PayrollStatus
  notes?: string
  financialTransactionId?: string
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'conflict'
}
