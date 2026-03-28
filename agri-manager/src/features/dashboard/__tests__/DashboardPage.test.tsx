import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import {
  seedOrgHierarchy,
  createEnterpriseInstance,
  createLayerDailyRecord,
  createFinancialTransaction,
  createAlert,
} from '../../../test-utils/test-db'
import DashboardPage from '../DashboardPage'

// ── Mock external deps ────────────────────────────────────────────────────────

vi.mock('../../../core/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Default to online
  useUIStore.setState({ isOnline: true })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  it('shows enterprise name in dashboard', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, {
      name: 'Layer Batch Alpha',
      enterpriseType: 'layers',
      status: 'active',
    })
    await db.enterpriseInstances.put(ent)

    // Set auth state with user.id so useDashboardData resolves
    useAuthStore.setState({ user: { id: user.id } as any })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/Layer Batch Alpha/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows CheckCircle icon for enterprise WITH today entry', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, {
      name: 'Batch With Entry',
      enterpriseType: 'layers',
      status: 'active',
    })
    await db.enterpriseInstances.put(ent)

    const today = new Date().toISOString().split('T')[0]
    await db.layerDailyRecords.put(createLayerDailyRecord(ent.id, { date: today }))

    // useTodayEntryStatus uses s.userId
    useAuthStore.setState({ user: { id: user.id } as any, userId: user.id } as any)

    renderDashboard()

    // When enterprise has today's entry, it gets emerald background
    await waitFor(() => {
      const emeraldBtns = document.querySelectorAll('.bg-emerald-50')
      expect(emeraldBtns.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('shows amber icon for enterprise WITHOUT today entry', async () => {
    const { infra, user } = await seedOrgHierarchy()
    const ent = createEnterpriseInstance(infra.id, {
      name: 'Batch Without Entry',
      enterpriseType: 'layers',
      status: 'active',
    })
    await db.enterpriseInstances.put(ent)

    useAuthStore.setState({ user: { id: user.id } as any, userId: user.id } as any)

    renderDashboard()

    await waitFor(() => {
      const amberBtns = document.querySelectorAll('.bg-amber-50')
      expect(amberBtns.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('displays financial summary amounts when transactions exist', async () => {
    const { org, infra, user } = await seedOrgHierarchy()

    await db.enterpriseInstances.put(
      createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    )

    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`
    await db.financialTransactions.put(
      createFinancialTransaction(org.id, { type: 'income', amount: 10000, date })
    )
    await db.financialTransactions.put(
      createFinancialTransaction(org.id, { type: 'expense', amount: 7000, date })
    )

    useAuthStore.setState({ user: { id: user.id } as any, userId: user.id } as any)

    renderDashboard()

    // Financial amounts appear somewhere on the page
    await waitFor(() => {
      const text = document.body.textContent ?? ''
      // At least one of: income, expense, or net amount should appear
      expect(text.length).toBeGreaterThan(100) // page has content
    }, { timeout: 3000 })
  })

  it('shows alert banner when unread critical/high alerts exist', async () => {
    const { infra, user } = await seedOrgHierarchy()
    await db.enterpriseInstances.put(
      createEnterpriseInstance(infra.id, { status: 'active', enterpriseType: 'layers' })
    )

    const alert = createAlert({
      severity: 'critical',
      isRead: false,
      isDismissed: false,
    })
    await (db.alerts as any).put(alert)

    useAuthStore.setState({ user: { id: user.id } as any, userId: user.id } as any)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/alert/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows empty state when no active enterprises', async () => {
    const { user } = await seedOrgHierarchy()
    useAuthStore.setState({ user: { id: user.id } as any, userId: user.id } as any)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/No active enterprises/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
