export type SyncStatus = 'pending' | 'synced' | 'conflict'

export interface BaseEntity {
  id: string
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
  syncStatus: SyncStatus
}

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
