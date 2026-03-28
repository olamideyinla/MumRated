import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { db } from '../../core/database/db'
import { todayStr } from './entry-store'
import { LayerEntryForm } from './LayerEntryForm'
import { BroilerEntryForm } from './BroilerEntryForm'
import { CattleEntryForm } from './CattleEntryForm'
import { FishEntryForm } from './FishEntryForm'
import { CropActivityForm } from './CropActivityForm'
import { GenericAnimalEntryForm } from './GenericAnimalEntryForm'
import { HealthEventBanner } from '../../shared/components/HealthEventBanner'
import type { EnterpriseInstance, Infrastructure } from '../../shared/types'

// ── Shared prop type ──────────────────────────────────────────────────────────

export interface EntryFormProps {
  enterprise: EnterpriseInstance
  infrastructure: Infrastructure
  date: string
}

// ── Back header ───────────────────────────────────────────────────────────────

function EntryHeader({ enterprise, infra }: { enterprise: EnterpriseInstance; infra: Infrastructure }) {
  const navigate = useNavigate()
  return (
    <div className="bg-primary-600 px-4 pt-3 pb-3 flex items-center gap-3 safe-top">
      <button
        onClick={() => navigate('/daily-entry')}
        className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform flex-shrink-0"
      >
        <ArrowLeft size={22} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold leading-tight truncate">{enterprise.name}</p>
        <p className="text-white/70 text-xs truncate">{infra.name}</p>
      </div>
    </div>
  )
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export default function EntryFormDispatcher() {
  const { enterpriseId } = useParams<{ enterpriseId: string }>()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') ?? todayStr()

  const data = useLiveQuery(async () => {
    if (!enterpriseId) return null
    const enterprise = await db.enterpriseInstances.get(enterpriseId)
    if (!enterprise) return null
    const infrastructure = await db.infrastructures.get(enterprise.infrastructureId)
    if (!infrastructure) return null
    return { enterprise, infrastructure }
  }, [enterpriseId])

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50 text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50 text-gray-500 text-sm">
        Enterprise not found.
      </div>
    )
  }

  const { enterprise, infrastructure } = data
  const props: EntryFormProps = { enterprise, infrastructure, date }

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      <EntryHeader enterprise={enterprise} infra={infrastructure} />
      <div className="px-4 pt-2">
        <HealthEventBanner enterpriseInstanceId={enterprise.id} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {(() => {
          switch (enterprise.enterpriseType) {
            case 'layers':          return <LayerEntryForm {...props} />
            case 'broilers':        return <BroilerEntryForm {...props} />
            case 'cattle_dairy':
            case 'cattle_beef':     return <CattleEntryForm {...props} />
            case 'fish':            return <FishEntryForm {...props} />
            case 'crop_annual':
            case 'crop_perennial':  return <CropActivityForm {...props} />
            case 'pigs_breeding':
            case 'pigs_growfinish':
            case 'rabbit':
            case 'custom_animal':   return <GenericAnimalEntryForm {...props} />
            default:                return null
          }
        })()}
      </div>
    </div>
  )
}
