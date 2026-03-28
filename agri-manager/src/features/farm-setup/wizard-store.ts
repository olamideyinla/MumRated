import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EnterpriseType, InfrastructureType } from '../../shared/types'
import { ENTERPRISE_TO_INFRA_TYPE, BATCH_PREFIX, getDefaultInfraName } from './wizard-data'
import { newId } from '../../shared/types/base'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfraItem {
  /** Temporary UUID — maps to a real DB id after submit */
  id: string
  enterpriseType: EnterpriseType
  infraType: InfrastructureType
  name: string
  capacity: string
  pondVolumeM3: string   // fish ponds only
  areaM2: string         // fields only (additional detail beyond capacity)
}

export interface StockEntry {
  infraId: string         // matches InfraItem.id
  isActive: boolean
  batchName: string
  startDate: string       // YYYY-MM-DD
  stockCount: string
  breedOrVariety: string
  breedIsCustom: boolean
  breedCustomText: string
}

export interface WizardState {
  // Navigation
  currentStep: number

  // Step 1 — Farm
  farmName: string
  address: string
  gpsLat: string
  gpsLng: string
  areaValue: string
  areaUnit: 'hectares' | 'acres'

  // Step 2 — Infrastructure
  selectedTypes: EnterpriseType[]
  infrastructures: InfraItem[]

  // Step 3 — Current stock
  stockEntries: StockEntry[]

  // Step 4 — Settings
  unitSystem: 'metric' | 'imperial'
  eggCountUnit: 'individual' | 'tray30' | 'crate360'
  feedBagKg: string    // '25', '50', or custom number string
  currency: string
  reminderTime: string // HH:MM
  language: string

  // Meta (not persisted)
  isSubmitting: boolean
  isComplete: boolean
  submitError: string | null
}

interface WizardActions {
  setStep1: (d: Partial<Pick<WizardState,
    'farmName' | 'address' | 'gpsLat' | 'gpsLng' | 'areaValue' | 'areaUnit'>>) => void
  setStep2: (d: Partial<Pick<WizardState, 'selectedTypes' | 'infrastructures'>>) => void
  initStockEntries: (infras: InfraItem[]) => void
  setStep3: (stockEntries: StockEntry[]) => void
  setStep4: (d: Partial<Pick<WizardState,
    'unitSystem' | 'eggCountUnit' | 'feedBagKg' | 'currency' | 'reminderTime' | 'language'>>) => void
  advance: () => void
  back: () => void
  goTo: (step: number) => void
  setSubmitting: (v: boolean) => void
  setSubmitError: (err: string | null) => void
  setComplete: () => void
  reset: () => void
}

// ── Default date helpers ──────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Store ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: Omit<WizardState, 'isSubmitting' | 'isComplete'> = {
  currentStep: 0,
  farmName: '',
  address: '',
  gpsLat: '',
  gpsLng: '',
  areaValue: '',
  areaUnit: 'hectares',
  selectedTypes: [],
  infrastructures: [],
  stockEntries: [],
  unitSystem: 'metric',
  eggCountUnit: 'individual',
  feedBagKg: '50',
  currency: 'USD',
  reminderTime: '18:00',
  language: 'en',
}

export const useWizardStore = create<WizardState & WizardActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      isSubmitting: false,
      isComplete: false,
      submitError: null,

      setStep1: (d) => set((s) => ({ ...s, ...d })),

      setStep2: (d) => set((s) => ({ ...s, ...d })),

      /**
       * Called when Step 2 completes. Syncs stockEntries to match the current
       * infra list — preserving any entries the user already filled in.
       */
      initStockEntries: (infras) => {
        const existing = get().stockEntries
        const batchCountPerType: Record<string, number> = {}

        const entries: StockEntry[] = infras.map((infra) => {
          batchCountPerType[infra.enterpriseType] = (batchCountPerType[infra.enterpriseType] ?? 0) + 1
          const count = batchCountPerType[infra.enterpriseType]
          const existing_ = existing.find(e => e.infraId === infra.id)
          if (existing_) return existing_
          return {
            infraId: infra.id,
            isActive: true,
            batchName: `${BATCH_PREFIX[infra.enterpriseType]} ${count}`,
            startDate: daysAgo(28),
            stockCount: '',
            breedOrVariety: '',
            breedIsCustom: false,
            breedCustomText: '',
          }
        })
        set({ stockEntries: entries })
      },

      setStep3: (stockEntries) => set({ stockEntries }),

      setStep4: (d) => set((s) => ({ ...s, ...d })),

      advance: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 4) })),

      back: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),

      goTo: (step) => set({ currentStep: step }),

      setSubmitting: (v) => set({ isSubmitting: v }),

      setSubmitError: (err) => set({ submitError: err }),

      setComplete: () => set({ isComplete: true, currentStep: 4, submitError: null }),

      reset: () => set({ ...INITIAL_STATE, isSubmitting: false, isComplete: false, submitError: null }),
    }),
    {
      name: 'agri-wizard-v1',
      // Exclude transient flags from localStorage
      partialize: (s) => ({
        currentStep: s.currentStep,
        farmName: s.farmName,
        address: s.address,
        gpsLat: s.gpsLat,
        gpsLng: s.gpsLng,
        areaValue: s.areaValue,
        areaUnit: s.areaUnit,
        selectedTypes: s.selectedTypes,
        infrastructures: s.infrastructures,
        stockEntries: s.stockEntries,
        unitSystem: s.unitSystem,
        eggCountUnit: s.eggCountUnit,
        feedBagKg: s.feedBagKg,
        currency: s.currency,
        reminderTime: s.reminderTime,
        language: s.language,
        isComplete: s.isComplete,
      }),
    },
  ),
)

// ── Convenience helpers ───────────────────────────────────────────────────────

export function makeInfraItem(
  enterpriseType: EnterpriseType,
  countOfType: number,
): InfraItem {
  return {
    id: newId(),
    enterpriseType,
    infraType: ENTERPRISE_TO_INFRA_TYPE[enterpriseType],
    name: getDefaultInfraName(enterpriseType, countOfType),
    capacity: '',
    pondVolumeM3: '',
    areaM2: '',
  }
}
