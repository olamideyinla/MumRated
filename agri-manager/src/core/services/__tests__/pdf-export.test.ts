import { describe, it, expect, vi } from 'vitest'
import type { EnterpriseInstance, FinancialTransaction } from '../../../shared/types'

// ── Mock jsPDF (no canvas in jsdom) ───────────────────────────────────────────

vi.mock('jspdf', () => ({
  // Use a regular function (not arrow) so it can be called with `new`
  default: vi.fn(function() {
    return {
      setFillColor: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      setPage: vi.fn(),
      rect: vi.fn(),
      text: vi.fn(),
      addPage: vi.fn(),
      line: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      getNumberOfPages: vi.fn().mockReturnValue(4),
      output: vi.fn(() => new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' })),
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
        getNumberOfPages: () => 4,
      },
    }
  }),
}))

vi.mock('jspdf-autotable', () => ({
  // Sets doc.lastAutoTable.finalY like the real plugin does
  default: vi.fn((doc: any) => { doc.lastAutoTable = { finalY: 100 } }),
}))

// ── Test data ─────────────────────────────────────────────────────────────────

function makeEnterprise(overrides: Partial<EnterpriseInstance> = {}): EnterpriseInstance {
  return {
    id: 'ent-1',
    infrastructureId: 'infra-1',
    enterpriseType: 'layers',
    name: 'Batch 2024-A',
    startDate: '2024-01-01',
    status: 'active',
    initialStockCount: 5000,
    currentStockCount: 4980,
    syncStatus: 'synced',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTxn(type: 'income' | 'expense', amount: number): FinancialTransaction {
  return {
    id: crypto.randomUUID(),
    organizationId: 'org-1',
    date: '2024-01-15',
    type,
    category: type === 'income' ? 'sales_eggs' : 'feed',
    amount,
    paymentMethod: 'cash',
    syncStatus: 'synced',
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createBatchReport', () => {
  it('returns a non-null Blob', async () => {
    const { createBatchReport } = await import('../pdf-export')
    const blob = createBatchReport({
      enterprise: makeEnterprise(),
      records: [],
      financials: [makeTxn('income', 5000), makeTxn('expense', 3000)],
      farmName: 'Test Farm',
    })
    expect(blob).not.toBeNull()
  })

  it('returned Blob has type application/pdf', async () => {
    const { createBatchReport } = await import('../pdf-export')
    const blob = createBatchReport({
      enterprise: makeEnterprise(),
      records: [],
      financials: [],
      farmName: 'Test Farm',
    })
    expect(blob.type).toBe('application/pdf')
  })

  it('returned Blob has size > 0', async () => {
    const { createBatchReport } = await import('../pdf-export')
    const blob = createBatchReport({
      enterprise: makeEnterprise(),
      records: [],
      financials: [],
      farmName: 'Test Farm',
    })
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles empty records without throwing', async () => {
    const { createBatchReport } = await import('../pdf-export')
    expect(() =>
      createBatchReport({
        enterprise: makeEnterprise(),
        records: [],
        financials: [],
        farmName: 'Test Farm',
      })
    ).not.toThrow()
  })
})

describe('createFarmPnLReport', () => {
  it('returns valid Blob with zero transactions', async () => {
    const { createFarmPnLReport } = await import('../pdf-export')
    const blob = createFarmPnLReport({
      dateRange: { from: '2024-01-01', to: '2024-01-31' },
      transactions: [],
      farmName: 'Test Farm',
    })
    expect(blob).not.toBeNull()
    expect(blob.size).toBeGreaterThan(0)
  })
})
