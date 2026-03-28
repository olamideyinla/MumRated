import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { deriveEventStatus } from '../../services/health-scheduler'
import type { ScheduledHealthEvent, HealthProtocol } from '../../../shared/types'

// ── useHealthProtocols ────────────────────────────────────────────────────────

export function useHealthProtocols(
  organizationId: string | undefined,
): HealthProtocol[] | undefined {
  return useLiveQuery(
    () => {
      if (!organizationId) return []
      return db.healthProtocols
        .where('organizationId').equals(organizationId)
        .toArray()
    },
    [organizationId],
  )
}

// ── useEnterpriseHealthEvents ─────────────────────────────────────────────────

export function useEnterpriseHealthEvents(
  enterpriseInstanceId: string | undefined,
): ScheduledHealthEvent[] | undefined {
  return useLiveQuery(
    async () => {
      if (!enterpriseInstanceId) return []
      const events = await db.scheduledHealthEvents
        .where('enterpriseInstanceId').equals(enterpriseInstanceId)
        .toArray()
      return events
        .map(e => ({ ...e, status: deriveEventStatus(e.scheduledDate, e.status) }))
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    },
    [enterpriseInstanceId],
  )
}

// ── useUpcomingHealthEvents ───────────────────────────────────────────────────

export function useUpcomingHealthEvents(
  organizationId: string | undefined,
  days = 7,
): ScheduledHealthEvent[] | undefined {
  return useLiveQuery(
    async () => {
      if (!organizationId) return []

      // Get all enterprise IDs for this org
      const locations = await db.farmLocations
        .where('organizationId').equals(organizationId).toArray()
      const locationIds = new Set(locations.map(l => l.id))
      const infras = await db.infrastructures.toArray()
      const orgInfraIds = new Set(infras.filter(i => locationIds.has(i.farmLocationId)).map(i => i.id))
      const enterprises = await db.enterpriseInstances
        .where('infrastructureId').anyOf([...orgInfraIds])
        .filter(e => e.status === 'active')
        .toArray()
      const enterpriseIds = new Set(enterprises.map(e => e.id))

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + days)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      const allEvents = await db.scheduledHealthEvents
        .where('scheduledDate').belowOrEqual(cutoffStr)
        .toArray()

      return allEvents
        .filter(e => enterpriseIds.has(e.enterpriseInstanceId))
        .map(e => ({ ...e, status: deriveEventStatus(e.scheduledDate, e.status) }))
        .filter(e => e.status !== 'completed' && e.status !== 'skipped')
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    },
    [organizationId, days],
  )
}

// ── useDueHealthCount ─────────────────────────────────────────────────────────

export function useDueHealthCount(
  organizationId: string | undefined,
): number {
  const events = useUpcomingHealthEvents(organizationId, 0)
  if (!events) return 0
  return events.filter(e => e.status === 'due_today' || e.status === 'overdue').length
}
