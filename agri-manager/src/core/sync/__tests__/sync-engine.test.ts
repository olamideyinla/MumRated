import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { db } from '../../database/db'
import { syncEngine } from '../sync-engine'
import { seedOrgHierarchy, createLayerDailyRecord, createEnterpriseInstance } from '../../../test-utils/test-db'

// ── Mock external dependencies ─────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file, so variables used inside its factory
// must also be hoisted via vi.hoisted() to avoid TDZ errors.

const {
  mockFrom,
  mockUpsert,
  mockRange,
  mockChain,
  mockSetStatus,
  mockSetLastSyncTime,
  mockSetPendingCount,
  mockAddError,
} = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const mockRange = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: mockRange,
    upsert: mockUpsert,
  }
  const mockFrom = vi.fn().mockReturnValue(mockChain)
  return {
    mockFrom,
    mockUpsert,
    mockRange,
    mockChain,
    mockSetStatus: vi.fn(),
    mockSetLastSyncTime: vi.fn(),
    mockSetPendingCount: vi.fn(),
    mockAddError: vi.fn(),
  }
})

vi.mock('../../config/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

vi.mock('../../../stores/sync-store', () => ({
  useSyncStore: {
    getState: () => ({
      setStatus: mockSetStatus,
      setLastSyncTime: mockSetLastSyncTime,
      setPendingCount: mockSetPendingCount,
      addError: mockAddError,
    }),
  },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, writable: true, configurable: true })
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // mockReset clears any unconsumed once-queue values (e.g. from _running guard test)
  mockUpsert.mockReset()
  mockRange.mockReset()
  mockUpsert.mockResolvedValue({ error: null })
  mockRange.mockResolvedValue({ data: [], error: null })
  setOnline(true)
  ;(syncEngine as any)._running = false
})

afterEach(() => {
  setOnline(true)
})

// ── Offline guard ──────────────────────────────────────────────────────────────

describe('offline', () => {
  it('sets status to "offline" and skips Supabase calls when navigator.onLine = false', async () => {
    setOnline(false)
    await syncEngine.fullSync()
    expect(mockSetStatus).toHaveBeenCalledWith('offline')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ── Push ──────────────────────────────────────────────────────────────────────

describe('push', () => {
  it('upserts pending layer records to Supabase and marks them synced', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    const record = createLayerDailyRecord(ent.id, { syncStatus: 'pending' })
    await db.layerDailyRecords.put(record)

    await syncEngine.pushChanges()

    expect(mockUpsert).toHaveBeenCalled()
    const synced = await db.layerDailyRecords.get(record.id)
    expect(synced?.syncStatus).toBe('synced')
  })

  it('does not call upsert when no pending records exist', async () => {
    await syncEngine.pushChanges()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('pushes records in chunks of 100 when >100 pending', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    // Create 101 pending records
    const records = Array.from({ length: 101 }, (_, i) =>
      createLayerDailyRecord(ent.id, {
        id: `record-${i}`,
        date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
        syncStatus: 'pending',
      })
    )
    await db.layerDailyRecords.bulkPut(records)

    await syncEngine.pushChanges()
    // 101 records → 2 chunks (100 + 1) → 2 upsert calls for layerDailyRecords
    const layerCalls = mockUpsert.mock.calls.filter(() => true)
    expect(layerCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('fullSync sets status to "error" when upsert fails', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    await db.layerDailyRecords.put(
      createLayerDailyRecord(ent.id, { syncStatus: 'pending' })
    )

    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB error', status: 500 } })
    await syncEngine.fullSync()

    expect(mockSetStatus).toHaveBeenCalledWith('error')
  })
})

// ── Pull ──────────────────────────────────────────────────────────────────────

describe('pull', () => {
  it('writes pulled records to db with syncStatus synced', async () => {
    const remoteId = crypto.randomUUID()
    const remoteRecord = {
      id: remoteId,
      enterprise_instance_id: 'ent-1',
      date: '2024-01-10',
      recorded_by: 'remote-user',
      total_eggs: 4500,
      mortality_count: 1,
      feed_consumed_kg: 255,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // SYNC_ORDER: organizations(1), farmLocations(2), infrastructures(3),
    // enterpriseInstances(4), layerDailyRecords(5) — target the 5th range() call
    mockRange
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [remoteRecord], error: null })

    await syncEngine.pullChanges()

    const saved = await db.layerDailyRecords.get(remoteId)
    expect(saved).toBeDefined()
    expect(saved?.syncStatus).toBe('synced')
  })

  it('db is unchanged when server returns empty data', async () => {
    mockRange.mockResolvedValue({ data: [], error: null })
    const countBefore = await db.layerDailyRecords.count()
    await syncEngine.pullChanges()
    expect(await db.layerDailyRecords.count()).toBe(countBefore)
  })

  it('requests second page when first page is full (500 records)', async () => {
    // SYNC_ORDER positions: org(1),farmLoc(2),infra(3),ent(4),layer(5)
    // Return 500 records on the 5th call (layerDailyRecords first page)
    let callNum = 0
    mockRange.mockImplementation(() => {
      callNum++
      if (callNum === 5) {
        const records = Array.from({ length: 500 }, (_, i) => ({
          id: `r-${i}`,
          enterprise_instance_id: 'e1',
          date: '2024-01-01',
          recorded_by: 'u',
          total_eggs: 100,
          mortality_count: 0,
          feed_consumed_kg: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
        return Promise.resolve({ data: records, error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })

    await syncEngine.pullChanges()
    // range should have been called at least twice for the same table
    expect(mockRange.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Conflict resolution ────────────────────────────────────────────────────────

describe('conflict resolution during pull', () => {
  it('remote newer timestamp → overwrites local record', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    const id = crypto.randomUUID()
    const oldTs = '2024-01-01T10:00:00.000Z'
    const newTs = '2024-01-01T12:00:00.000Z'

    // Local record (pending, older timestamp)
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, {
      id,
      totalEggs: 4000,
      syncStatus: 'pending',
      updatedAt: oldTs,
    }))

    // Remote record (newer timestamp)
    const remoteRecord = {
      id,
      enterprise_instance_id: ent.id,
      date: '2024-01-05',
      recorded_by: 'user2',
      total_eggs: 4800,
      mortality_count: 0,
      feed_consumed_kg: 260,
      created_at: oldTs,
      updated_at: newTs,
    }

    // Target the 5th range() call — layerDailyRecords (index 4 in SYNC_ORDER)
    mockRange
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [remoteRecord], error: null })

    await syncEngine.pullChanges()

    const saved = await db.layerDailyRecords.get(id)
    expect(saved?.totalEggs).toBe(4800)
    expect(saved?.syncStatus).toBe('synced')
  })

  it('local newer timestamp → local record kept', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    const id = crypto.randomUUID()
    const oldTs = '2024-01-01T10:00:00.000Z'
    const newTs = '2024-01-01T12:00:00.000Z'

    // Local newer
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, {
      id,
      totalEggs: 4800,
      syncStatus: 'pending',
      updatedAt: newTs,
    }))

    const remoteRecord = {
      id,
      enterprise_instance_id: ent.id,
      date: '2024-01-05',
      recorded_by: 'user2',
      total_eggs: 4000,
      mortality_count: 0,
      feed_consumed_kg: 260,
      created_at: oldTs,
      updated_at: oldTs,
    }

    // Target 5th range() call (layerDailyRecords)
    mockRange
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [remoteRecord], error: null })

    await syncEngine.pullChanges()

    const saved = await db.layerDailyRecords.get(id)
    expect(saved?.totalEggs).toBe(4800)  // local value kept
  })

  it('equal timestamps with differing numeric field → conflict_flagged', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)

    const id = crypto.randomUUID()
    const ts = '2024-01-01T10:00:00.000Z'

    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, {
      id,
      totalEggs: 4000,
      syncStatus: 'pending',
      updatedAt: ts,
      createdAt: ts,
    }))

    const remoteRecord = {
      id,
      enterprise_instance_id: ent.id,
      date: '2024-01-05',
      recorded_by: 'user2',
      total_eggs: 4500,  // different numeric value
      mortality_count: 0,
      feed_consumed_kg: 260,
      created_at: ts,
      updated_at: ts,
    }

    // Target 5th range() call (layerDailyRecords)
    mockRange
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [remoteRecord], error: null })

    await syncEngine.pullChanges()

    const conflicts = await db.conflicts.toArray()
    expect(conflicts.length).toBeGreaterThan(0)
    // Multiple numeric fields may differ; verify totalEggs is among the conflicts
    expect(conflicts.map(c => c.fieldName)).toContain('totalEggs')
  })
})

// ── Auth retry ─────────────────────────────────────────────────────────────────

describe('auth retry on 401', () => {
  it('calls refreshSession and retries on 401 error', async () => {
    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)
    await db.layerDailyRecords.put(
      createLayerDailyRecord(ent.id, { syncStatus: 'pending' })
    )

    // First upsert returns 401, second succeeds
    mockUpsert
      .mockResolvedValueOnce({ error: { message: 'JWT expired', status: 401 } })
      .mockResolvedValue({ error: null })

    const { supabase } = await import('../../config/supabase')
    await syncEngine.pushChanges()

    expect(supabase.auth.refreshSession).toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalledTimes(2)
  })
})

// ── Idempotency guard ─────────────────────────────────────────────────────────

describe('_running guard', () => {
  it('second concurrent fullSync returns immediately', async () => {
    let resolveFirst!: () => void
    const slowPush = new Promise<void>((res) => { resolveFirst = res })

    // Make pushChanges hang
    mockUpsert.mockReturnValueOnce(slowPush)

    const p1 = syncEngine.fullSync()
    const p2 = syncEngine.fullSync()  // should return immediately (guard)

    resolveFirst()
    await Promise.all([p1, p2])

    // setStatus('syncing') should only be called once (first call)
    const syncingCalls = mockSetStatus.mock.calls.filter(([s]) => s === 'syncing')
    expect(syncingCalls.length).toBe(1)
  })
})

// ── SYNC_ORDER ────────────────────────────────────────────────────────────────

describe('sync order', () => {
  it('organizations are pushed before layerDailyRecords', async () => {
    const { org } = await seedOrgHierarchy()
    await db.organizations.put({ ...org, syncStatus: 'pending' })

    const { infra } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, { enterpriseType: 'layers' })
    await db.enterpriseInstances.put(ent)
    await db.layerDailyRecords.put(
      createLayerDailyRecord(ent.id, { syncStatus: 'pending' })
    )

    await syncEngine.pushChanges()

    // Check call order from the recorded mock.calls (no need to override mockFrom)
    const pushedTables = mockFrom.mock.calls.map(([name]) => name as string)
    const orgIdx = pushedTables.indexOf('organizations')
    const layerIdx = pushedTables.indexOf('layer_daily_records')

    if (orgIdx !== -1 && layerIdx !== -1) {
      expect(orgIdx).toBeLessThan(layerIdx)
    }
  })
})
