import type { BaseEntity } from './base'

export type UserRole = 'owner' | 'manager' | 'supervisor' | 'worker' | 'viewer'

export interface AppUser extends BaseEntity {
  organizationId: string
  email?: string
  fullName: string
  phone?: string
  role: UserRole
  assignedFarmLocationIds: string[]
  assignedInfrastructureIds: string[]
  isActive: boolean
}
