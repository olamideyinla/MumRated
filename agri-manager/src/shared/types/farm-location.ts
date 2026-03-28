import type { BaseEntity } from './base'

export interface FarmLocation extends BaseEntity {
  organizationId: string
  name: string
  gpsLatitude?: number
  gpsLongitude?: number
  address?: string
  totalAreaHectares?: number
  altitudeMeters?: number
  climateZone?: string
  status: 'active' | 'inactive'
}
