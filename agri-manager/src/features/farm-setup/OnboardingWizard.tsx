import { useRef, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import { newId, nowIso } from '../../shared/types/base'
import { useWizardStore } from './wizard-store'
import { seedDefaultProtocols, generateEventsForEnterpriseInOrg } from '../../core/services/health-scheduler'
import { StepIndicator } from '../../shared/components/wizard/StepIndicator'
import { WizardNavButtons } from '../../shared/components/wizard/WizardNavButtons'
import { Step1Farm } from './steps/Step1Farm'
import { Step2Infrastructure } from './steps/Step2Infrastructure'
import { Step3CurrentStock } from './steps/Step3CurrentStock'
import { Step4Settings } from './steps/Step4Settings'
import { Step5Complete } from './steps/Step5Complete'
import type { StepHandle } from './steps/Step1Farm'

// ── Step labels ───────────────────────────────────────────────────────────────

const STEP_LABELS = ['Your Farm', 'Infrastructure', 'Current Stock', 'Preferences', 'All Set!']

// ── Submit logic ──────────────────────────────────────────────────────────────

async function submitWizard() {
  const appUser = useAuthStore.getState().appUser
  if (!appUser) {
    useWizardStore.getState().setSubmitError('Session not found. Please sign out and sign in again.')
    return
  }

  const s = useWizardStore.getState()
  useWizardStore.getState().setSubmitting(true)
  useWizardStore.getState().setSubmitError(null)

  try {
    const ts = nowIso()

    // Load existing org + farm location
    const [org, farmLocations] = await Promise.all([
      db.organizations.get(appUser.organizationId),
      db.farmLocations.where('organizationId').equals(appUser.organizationId).toArray(),
    ])
    const farmLoc = farmLocations[0]
    if (!org || !farmLoc) throw new Error('Organization or farm location not found')

    // Convert area value to hectares
    const areaHa = s.areaValue
      ? s.areaUnit === 'hectares'
        ? parseFloat(s.areaValue)
        : parseFloat(s.areaValue) * 0.404686
      : undefined

    const allInfraIds: string[] = []

    await db.transaction(
      'rw',
      [db.organizations, db.farmLocations, db.infrastructures, db.enterpriseInstances, db.appUsers],
      async () => {
        // Update organization
        await db.organizations.put({
          ...org,
          currency: s.currency || org.currency,
          defaultUnitSystem: s.unitSystem,
          updatedAt: ts,
          syncStatus: 'pending',
        })

        // Update farm location
        await db.farmLocations.put({
          ...farmLoc,
          name: s.farmName || farmLoc.name,
          address: s.address || farmLoc.address,
          gpsLatitude: s.gpsLat ? parseFloat(s.gpsLat) : farmLoc.gpsLatitude,
          gpsLongitude: s.gpsLng ? parseFloat(s.gpsLng) : farmLoc.gpsLongitude,
          totalAreaHectares: areaHa ?? farmLoc.totalAreaHectares,
          updatedAt: ts,
          syncStatus: 'pending',
        })

        // Create infrastructure items
        const infraIdMap: Record<string, string> = {}

        for (const item of s.infrastructures) {
          const realId = newId()
          infraIdMap[item.id] = realId
          allInfraIds.push(realId)
          await db.infrastructures.add({
            id: realId,
            farmLocationId: farmLoc.id,
            name: item.name,
            type: item.infraType,
            capacity: item.capacity ? Math.round(parseFloat(item.capacity)) : undefined,
            areaSquareMeters: item.areaM2 ? parseFloat(item.areaM2) : undefined,
            status: 'active',
            createdAt: ts,
            updatedAt: ts,
            syncStatus: 'pending',
          })
        }

        // Create enterprise instances (active batches only)
        for (const entry of s.stockEntries.filter(e => e.isActive)) {
          const realInfraId = infraIdMap[entry.infraId]
          if (!realInfraId) continue
          const infra = s.infrastructures.find(i => i.id === entry.infraId)
          if (!infra) continue

          const stockCount = parseInt(entry.stockCount) || 0
          const breed = entry.breedIsCustom
            ? entry.breedCustomText
            : entry.breedOrVariety

          await db.enterpriseInstances.add({
            id: newId(),
            infrastructureId: realInfraId,
            enterpriseType: infra.enterpriseType,
            name: entry.batchName || 'Batch 1',
            startDate: entry.startDate,
            status: 'active',
            initialStockCount: stockCount,
            currentStockCount: stockCount,
            breedOrVariety: breed || undefined,
            createdAt: ts,
            updatedAt: ts,
            syncStatus: 'pending',
          })
        }

        // Append new infra IDs to existing list (don't overwrite)
        const existingInfraIds = appUser.assignedInfrastructureIds ?? []
        const merged = [...new Set([...existingInfraIds, ...allInfraIds])]
        await db.appUsers.put({
          ...appUser,
          assignedInfrastructureIds: merged,
          updatedAt: ts,
          syncStatus: 'pending',
        })
      },
    )

    // Seed default health protocols + generate events for all new enterprises
    try {
      await seedDefaultProtocols(appUser.organizationId)
      const newEnterprises = await db.enterpriseInstances
        .where('infrastructureId').anyOf(allInfraIds)
        .filter(e => e.status === 'active')
        .toArray()
      await Promise.all(
        newEnterprises.map(e => generateEventsForEnterpriseInOrg(e, appUser.organizationId))
      )
    } catch (healthErr) {
      console.warn('Health setup non-fatal:', healthErr)
    }

    useWizardStore.getState().setComplete()
  } catch (err) {
    console.error('Wizard submit failed:', err)
    useWizardStore.getState().setSubmitError(
      err instanceof Error ? err.message : 'Setup failed. Please try again.'
    )
  } finally {
    useWizardStore.getState().setSubmitting(false)
  }
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const appUser = useAuthStore(s => s.appUser)
  const {
    currentStep, isSubmitting, isComplete, submitError,
    setStep1, setStep2, initStockEntries, setStep3, setStep4,
    advance, back,
  } = useWizardStore()

  const stepRef = useRef<StepHandle>(null)

  // Pre-fill from existing DB data on first render (only if fields are empty)
  useEffect(() => {
    if (!appUser) return
    const s = useWizardStore.getState()
    if (s.farmName) return  // Already initialized from localStorage

    db.organizations.get(appUser.organizationId).then(org => {
      db.farmLocations.where('organizationId').equals(appUser.organizationId).first().then(loc => {
        setStep1({
          farmName: loc?.name || org?.name || '',
          address: loc?.address || '',
          gpsLat: loc?.gpsLatitude != null ? String(loc.gpsLatitude) : '',
          gpsLng: loc?.gpsLongitude != null ? String(loc.gpsLongitude) : '',
          areaValue: loc?.totalAreaHectares != null ? String(loc.totalAreaHectares) : '',
          areaUnit: 'hectares',
        })
        if (org) setStep4({ currency: org.currency, unitSystem: org.defaultUnitSystem })
      })
    })
  }, [appUser, setStep1, setStep4])

  // ── Step completion handlers ──────────────────────────────────────────────

  const handleStep1Complete = (data: Parameters<typeof setStep1>[0]) => {
    setStep1(data)
    advance()
  }

  const handleStep2Complete = (data: { selectedTypes: any[]; items: any[] }) => {
    setStep2({ selectedTypes: data.selectedTypes, infrastructures: data.items })
    initStockEntries(data.items)
    advance()
  }

  const handleStep3Complete = (data: { entries: any[] }) => {
    setStep3(data.entries)
    advance()
  }

  const handleStep4Complete = async (data: any) => {
    const feedBag = data.feedBagKg === 'other' ? data.feedBagCustom || '50' : data.feedBagKg
    setStep4({
      unitSystem: data.unitSystem,
      eggCountUnit: data.eggCountUnit,
      feedBagKg: feedBag,
      currency: data.currency,
      reminderTime: data.reminderTime,
      language: data.language,
    })
    await submitWizard()
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = () => {
    stepRef.current?.submit()
  }

  const handleSkip = async () => {
    if (currentStep === 2) {
      // Skip Step 3 (stock) — keep default empty entries
      advance()
    } else if (currentStep === 3) {
      // Skip Step 4 (settings) — use defaults
      await submitWizard()
    }
  }

  // On completion, no more nav buttons
  if (isComplete) {
    return (
      <div className="h-dvh flex flex-col bg-white">
        <StepIndicator currentStep={4} steps={STEP_LABELS} />
        <div className="flex-1 overflow-y-auto">
          <Step5Complete />
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-white">
      <StepIndicator currentStep={currentStep} steps={STEP_LABELS} />

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 0 && (
          <Step1Farm ref={stepRef} onComplete={handleStep1Complete} />
        )}
        {currentStep === 1 && (
          <Step2Infrastructure ref={stepRef} onComplete={handleStep2Complete} />
        )}
        {currentStep === 2 && (
          <Step3CurrentStock ref={stepRef} onComplete={handleStep3Complete} />
        )}
        {currentStep === 3 && (
          <Step4Settings ref={stepRef} onComplete={handleStep4Complete} />
        )}
        {currentStep === 4 && <Step5Complete />}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-700 text-center">{submitError}</p>
        </div>
      )}

      {/* Sticky navigation */}
      {currentStep < 4 && (
        <WizardNavButtons
          currentStep={currentStep}
          totalSteps={STEP_LABELS.length}
          onBack={back}
          onNext={handleNext}
          onSkip={handleSkip}
          canSkip={currentStep === 2 || currentStep === 3}
          isLoading={isSubmitting}
        />
      )}
    </div>
  )
}
