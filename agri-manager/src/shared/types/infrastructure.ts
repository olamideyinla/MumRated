import type { BaseEntity } from './base'

export type InfrastructureType =
  | 'poultry_house'
  | 'fish_pond'
  | 'cattle_pen'
  | 'pig_pen'
  | 'rabbit_hutch'
  | 'field'
  | 'greenhouse'
  | 'other'

export interface Infrastructure extends BaseEntity {
  farmLocationId: string
  name: string
  type: InfrastructureType
  capacity?: number
  areaSquareMeters?: number
  description?: string
  status: 'active' | 'maintenance' | 'empty'
}
