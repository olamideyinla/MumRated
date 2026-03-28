import { db } from '../database/db'
import { newId, nowIso } from '../../shared/types/base'
import { DEFAULT_PROTOCOLS } from './default-health-protocols'
import type { EnterpriseInstance, HealthProtocol, HealthEventStatus, ScheduledHealthEvent } from '../../shared/types'

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Status derivation ─────────────────────────────────────────────────────────

export function deriveEventStatus(
  scheduledDate: string,
  status: HealthEventStatus,
): HealthEventStatus {
  if (status === 'completed' || status === 'skipped') return status
  const today = todayIso()
  if (scheduledDate === today) return 'due_today'
  if (scheduledDate < today)  return 'overdue'
  return 'upcoming'
}

// ── Apply a protocol to a single enterprise ───────────────────────────────────

export async function applyProtocolToEnterprise(
  enterpriseId: string,
  startDate: string,
  protocol: HealthProtocol,
): Promise<void> {
  const ts = nowIso()
  const events: ScheduledHealthEvent[] = protocol.events.map(evt => ({
    id: newId(),
    enterpriseInstanceId: enterpriseId,
    protocolId: protocol.id,
    protocolEventId: evt.id,
    name: evt.name,
    eventType: evt.eventType,
    scheduledDate: addDays(startDate, evt.dayOffset),
    status: 'upcoming' as HealthEventStatus,
    product: evt.product,
    dosage: evt.dosage,
    route: evt.route,
    notes: evt.notes,
    syncStatus: 'pending',
    createdAt: ts,
    updatedAt: ts,
  }))
  await db.scheduledHealthEvents.bulkPut(events)
}

// ── Seed default protocols for an organization ───────────────────────────────

export async function seedDefaultProtocols(organizationId: string): Promise<void> {
  const existing = await db.healthProtocols
    .where('organizationId').equals(organizationId)
    .count()
  if (existing > 0) return  // Already seeded

  const ts = nowIso()
  const protocols: HealthProtocol[] = DEFAULT_PROTOCOLS.map(tpl => ({
    ...tpl,
    id: newId(),
    organizationId,
    createdAt: ts,
    updatedAt: ts,
  }))
  await db.healthProtocols.bulkPut(protocols)
}

// ── Generate events for a single enterprise from matching default protocol ────

export async function generateEventsForEnterprise(
  enterprise: EnterpriseInstance,
): Promise<void> {
  // Check if events already exist for this enterprise
  const existing = await db.scheduledHealthEvents
    .where('enterpriseInstanceId').equals(enterprise.id)
    .count()
  if (existing > 0) return

  // Find matching default protocol
  const protocol = await db.healthProtocols
    .where('enterpriseType').equals(enterprise.enterpriseType)
    .filter(p => p.organizationId === (enterprise as any)._orgId || p.isDefault)
    .first()

  if (!protocol) return
  await applyProtocolToEnterprise(enterprise.id, enterprise.startDate, protocol)
}

// ── Generate events using org lookup ─────────────────────────────────────────

export async function generateEventsForEnterpriseInOrg(
  enterprise: EnterpriseInstance,
  organizationId: string,
): Promise<void> {
  const existing = await db.scheduledHealthEvents
    .where('enterpriseInstanceId').equals(enterprise.id)
    .count()
  if (existing > 0) return

  const protocol = await db.healthProtocols
    .where('organizationId').equals(organizationId)
    .filter(p => p.enterpriseType === enterprise.enterpriseType)
    .first()

  if (!protocol) return
  await applyProtocolToEnterprise(enterprise.id, enterprise.startDate, protocol)
}
