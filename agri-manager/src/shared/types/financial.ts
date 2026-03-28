import type { BaseEntity } from './base'

export type TransactionType = 'income' | 'expense'

export type FinancialCategory =
  | 'feed'
  | 'labor'
  | 'medication'
  | 'transport'
  | 'utilities'
  | 'sales_eggs'
  | 'sales_birds'
  | 'sales_milk'
  | 'sales_fish'
  | 'sales_crops'
  | 'sales_other'
  | 'rent'
  | 'insurance'
  | 'equipment'
  | 'administrative'
  | 'other'

export type PaymentMethod = 'cash' | 'bank' | 'mobile_money' | 'credit'

export interface FinancialTransaction extends BaseEntity {
  organizationId: string
  enterpriseInstanceId?: string
  date: string  // YYYY-MM-DD
  type: TransactionType
  category: FinancialCategory
  amount: number
  paymentMethod: PaymentMethod
  counterpartyId?: string
  reference?: string
  notes?: string
}
