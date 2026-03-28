import type { BaseEntity } from './base'

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info'

export interface Alert extends BaseEntity {
  /** Alert rule identifier, e.g. 'layer_production_drop' */
  type: string
  severity: AlertSeverity
  message: string
  enterpriseInstanceId?: string
  isRead: boolean
  isDismissed: boolean
  actionRoute?: string
  actionLabel?: string
}
