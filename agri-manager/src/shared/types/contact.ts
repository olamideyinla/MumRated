import type { BaseEntity } from './base'

export type ContactType =
  | 'supplier'
  | 'buyer'
  | 'vet'
  | 'extension_officer'
  | 'employee'
  | 'transporter'
  | 'other'

export interface Contact extends BaseEntity {
  organizationId: string
  name: string
  phone?: string
  email?: string
  address?: string
  type: ContactType
  notes?: string
}
