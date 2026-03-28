import type { BaseEntity } from './base'

export type EnterpriseType =
  | 'layers'
  | 'broilers'
  | 'cattle_dairy'
  | 'cattle_beef'
  | 'pigs_breeding'
  | 'pigs_growfinish'
  | 'fish'
  | 'crop_annual'
  | 'crop_perennial'
  | 'rabbit'
  | 'custom_animal'

export interface EnterpriseInstance extends BaseEntity {
  infrastructureId: string
  enterpriseType: EnterpriseType
  name: string
  startDate: string         // YYYY-MM-DD
  expectedEndDate?: string  // YYYY-MM-DD
  actualEndDate?: string    // YYYY-MM-DD
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  initialStockCount: number
  currentStockCount: number
  breedOrVariety?: string
  source?: string
  notes?: string
}
