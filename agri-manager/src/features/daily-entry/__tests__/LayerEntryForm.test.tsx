import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../../core/database/db'
import { useAuthStore } from '../../../stores/auth-store'
import { useUIStore } from '../../../stores/ui-store'
import { LayerEntryForm } from '../LayerEntryForm'
import {
  seedOrgHierarchy,
  createEnterpriseInstance,
  createLayerDailyRecord,
} from '../../../test-utils/test-db'
import type { EnterpriseInstance, Infrastructure } from '../../../shared/types'

// ── Mock supabase ─────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

let enterprise: EnterpriseInstance
let infrastructure: Infrastructure

// NumberInput renders <label> without htmlFor — find the input via its parent wrapper
function getInputByLabel(labelText: string): HTMLInputElement {
  return screen.getByText(labelText).parentElement!.querySelector('input') as HTMLInputElement
}

function renderForm(ent = enterprise, infra = infrastructure, date = TODAY) {
  return render(
    <MemoryRouter>
      <LayerEntryForm enterprise={ent} infrastructure={infra} date={date} />
    </MemoryRouter>
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()

  const { infra, user } = await seedOrgHierarchy()
  useAuthStore.setState({ user: { id: user.id } as any })
  useUIStore.setState({ addToast: vi.fn() } as any)

  infrastructure = infra
  enterprise = createEnterpriseInstance(infra.id, {
    enterpriseType: 'layers',
    currentStockCount: 5000,
    status: 'active',
  })
  await db.enterpriseInstances.put(enterprise)
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LayerEntryForm', () => {
  it('renders egg collection, mortality, and feed sections', async () => {
    renderForm()

    expect(screen.getByText(/Egg Collection/i)).toBeInTheDocument()
    expect(screen.getByText(/Mortality/i)).toBeInTheDocument()
    // Use h3 selector to avoid matching "Feed consumed" / "Feed type" labels
    expect(screen.getByText('Feed', { selector: 'h3' })).toBeInTheDocument()
  })

  it('valid submit saves a layer record to db', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    renderForm()

    await waitFor(() => {
      expect(screen.getByText(/Egg Collection/i)).toBeInTheDocument()
    })

    // NumberInput has no htmlFor — locate via parent element
    const eggInput = getInputByLabel('Individual Eggs')
    await user.clear(eggInput)
    await user.type(eggInput, '4500')

    // Actual placeholder is "e.g. Layer Pellets, Mash"
    const feedInput = screen.getByPlaceholderText(/Layer Pellets/i)
    await user.type(feedInput, 'Layer Pellets')

    const saveBtn = screen.getByRole('button', { name: /save/i })
    await user.click(saveBtn)

    await waitFor(async () => {
      const count = await db.layerDailyRecords.count()
      expect(count).toBe(1)
    }, { timeout: 3000 })

    const records = await db.layerDailyRecords.toArray()
    expect(records[0].totalEggs).toBe(4500)
  })

  it('HDP percentage shown in real-time as user types eggs', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    renderForm()

    await waitFor(() => screen.getByText(/Egg Collection/i))

    // 5000 eggs / 5000 hens = 100%
    const eggInput = getInputByLabel('Individual Eggs')
    await user.clear(eggInput)
    await user.type(eggInput, '5000')

    await waitFor(() => {
      expect(screen.getByText(/100%/)).toBeInTheDocument()
    })
  })

  it('pre-populates form when an existing record is present', async () => {
    await db.layerDailyRecords.put(createLayerDailyRecord(enterprise.id, {
      date: TODAY,
      totalEggs: 3800,
      mortalityCount: 5,
      feedConsumedKg: 240,
    }))

    renderForm()

    await waitFor(() => {
      const eggInput = getInputByLabel('Individual Eggs')
      expect(eggInput.value).toBe('3800')
    }, { timeout: 3000 })
  })

  it("shows yesterday's reference when yesterday record exists", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yDate = yesterday.toISOString().split('T')[0]

    await db.layerDailyRecords.put(createLayerDailyRecord(enterprise.id, {
      date: yDate,
      totalEggs: 4100,
      mortalityCount: 3,
    }))

    renderForm()

    await waitFor(() => {
      expect(screen.getByText(/4100 eggs/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('draft auto-saves to localStorage after 30 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    renderForm()

    await waitFor(() => screen.getByText(/Egg Collection/i))

    const eggInput = getInputByLabel('Individual Eggs')
    await user.type(eggInput, '3000')

    // Advance 31 seconds to trigger the auto-save interval
    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })

    const draftKey = `draft-layer-${enterprise.id}-${TODAY}`
    const stored = localStorage.getItem(draftKey)
    expect(stored).not.toBeNull()
    const draft = JSON.parse(stored!)
    expect(draft.data.eggInput).toBe('3000')
  })
})
