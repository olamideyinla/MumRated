import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '../db'
import { useActiveEnterprises } from '../hooks/use-enterprises'
import { useRecordsForEnterprise, useTodayEntryStatus } from '../hooks/use-daily-records'
import { useAuthStore } from '../../../stores/auth-store'
import {
  seedOrgHierarchy,
  createEnterpriseInstance,
  createLayerDailyRecord,
} from '../../../test-utils/test-db'

// ── Mock supabase so auth-store doesn't make real network calls ───────────────

vi.mock('../../../core/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function setUserId(id: string | undefined) {
  // The hooks access s.userId which is not in the typed interface but
  // Zustand allows setting any key via setState
  useAuthStore.setState({ userId: id } as any)
}

// ── useActiveEnterprises ──────────────────────────────────────────────────────

describe('useActiveEnterprises', () => {
  it('returns [] when userId is not set', async () => {
    setUserId(undefined)
    const { result } = renderHook(() => useActiveEnterprises())
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current).toEqual([])
  })

  it('returns active enterprise after seeding', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)
    setUserId(user.id)

    const { result } = renderHook(() => useActiveEnterprises())
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
      expect(result.current!.length).toBeGreaterThan(0)
    })
    expect(result.current![0].id).toBe(ent.id)
  })

  it('filters out completed enterprises', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const active = createEnterpriseInstance(infra.id, { status: 'active' })
    const completed = createEnterpriseInstance(infra.id, { status: 'completed' })
    await db.enterpriseInstances.bulkPut([active, completed])
    setUserId(user.id)

    const { result } = renderHook(() => useActiveEnterprises())
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
    })
    const ids = result.current!.map(e => e.id)
    expect(ids).toContain(active.id)
    expect(ids).not.toContain(completed.id)
  })
})

// ── useTodayEntryStatus ────────────────────────────────────────────────────────

describe('useTodayEntryStatus', () => {
  it('returns hasEntryToday=true when today record exists', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    const today = new Date().toISOString().split('T')[0]
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: today }))
    setUserId(user.id)

    const { result } = renderHook(() => useTodayEntryStatus())
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
      expect(result.current!.length).toBeGreaterThan(0)
    })
    const status = result.current!.find(s => s.enterpriseId === ent.id)
    expect(status?.hasEntryToday).toBe(true)
  })

  it('returns hasEntryToday=false when no today record', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)
    setUserId(user.id)

    const { result } = renderHook(() => useTodayEntryStatus())
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
    })
    const status = result.current!.find(s => s.enterpriseId === ent.id)
    expect(status?.hasEntryToday).toBe(false)
  })

  it('returns correct status per enterprise when multiple exist', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const entA = createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    const entB = createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    await db.enterpriseInstances.bulkPut([entA, entB])

    const today = new Date().toISOString().split('T')[0]
    // Only entA has a today record
    await db.layerDailyRecords.put(createLayerDailyRecord(entA.id, { date: today }))
    setUserId(user.id)

    const { result } = renderHook(() => useTodayEntryStatus())
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
      expect(result.current!.length).toBeGreaterThanOrEqual(2)
    })

    const statusA = result.current!.find(s => s.enterpriseId === entA.id)
    const statusB = result.current!.find(s => s.enterpriseId === entB.id)
    expect(statusA?.hasEntryToday).toBe(true)
    expect(statusB?.hasEntryToday).toBe(false)
  })
})

// ── useRecordsForEnterprise ────────────────────────────────────────────────────

describe('useRecordsForEnterprise', () => {
  it('returns layer records for a layers enterprise', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: '2024-06-01' }))
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: '2024-06-02' }))

    const { result } = renderHook(() => useRecordsForEnterprise(ent.id))
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
      expect(result.current!.length).toBe(2)
    })
  })

  it('filters records within dateRange', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: '2024-06-01' }))
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: '2024-06-15' }))
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: '2024-07-01' }))

    const { result } = renderHook(() =>
      useRecordsForEnterprise(ent.id, { from: '2024-06-01', to: '2024-06-30' })
    )
    await waitFor(() => {
      expect(result.current).not.toBeUndefined()
      expect(result.current!.length).toBe(2)
    })
  })

  it('reacts to new records added after render', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    const { result } = renderHook(() => useRecordsForEnterprise(ent.id))

    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.length).toBe(0)

    // Add a record after the hook has rendered
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: '2024-06-01' }))

    await waitFor(() => {
      expect(result.current!.length).toBe(1)
    })
  })
})
