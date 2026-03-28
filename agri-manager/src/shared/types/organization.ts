import type { BaseEntity } from './base'

export interface Organization extends BaseEntity {
  name: string
  registrationNumber?: string
  taxId?: string
  /** ISO 4217 currency code, default 'USD' */
  currency: string
  defaultUnitSystem: 'metric' | 'imperial'
}
