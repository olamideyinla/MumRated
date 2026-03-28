import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useEnterprise } from '../../core/database/hooks/use-enterprises'
import { LayerOverview } from './layers/LayerOverview'
import { BroilerOverview } from './broilers/BroilerOverview'
import { FishOverview } from './fishery/FishOverview'
import { CattleOverview } from './cattle/CattleOverview'
import { CropOverview } from './crops/CropOverview'
import { EnterpriseRecords } from './tabs/EnterpriseRecords'
import { EnterpriseAnalysis } from './tabs/EnterpriseAnalysis'
import { EnterpriseFinancials } from './tabs/EnterpriseFinancials'
import { EnterpriseHealthTab } from './tabs/EnterpriseHealthTab'
import type { EnterpriseType, EnterpriseInstance } from '../../shared/types'

// ── Type labels & badges ──────────────────────────────────────────────────────

const TYPE_LABEL: Record<EnterpriseType, string> = {
  layers:          'Layers',
  broilers:        'Broilers',
  cattle_dairy:    'Dairy Cattle',
  cattle_beef:     'Beef Cattle',
  pigs_breeding:   'Pigs (Breeding)',
  pigs_growfinish: 'Pigs (Grow/Finish)',
  fish:            'Fishery',
  crop_annual:     'Annual Crop',
  crop_perennial:  'Perennial Crop',
  rabbit:          'Rabbits',
  custom_animal:   'Custom Animal',
}

const TYPE_ICON: Record<EnterpriseType, string> = {
  layers: '🥚', broilers: '🐔', cattle_dairy: '🐄', cattle_beef: '🐂',
  pigs_breeding: '🐷', pigs_growfinish: '🐖', fish: '🐟',
  crop_annual: '🌾', crop_perennial: '🌳', rabbit: '🐰', custom_animal: '🐾',
}

const STATUS_STYLE = {
  active:    'bg-emerald-100 text-emerald-700',
  planned:   'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Records', 'Analysis', 'Financial', 'Health'] as const
type TabId = typeof TABS[number]

// ── Overview dispatcher ───────────────────────────────────────────────────────

function Overview({ enterprise }: { enterprise: EnterpriseInstance }) {
  switch (enterprise.enterpriseType) {
    case 'layers':          return <LayerOverview enterprise={enterprise} />
    case 'broilers':        return <BroilerOverview enterprise={enterprise} />
    case 'cattle_dairy':
    case 'cattle_beef':     return <CattleOverview enterprise={enterprise} />
    case 'fish':            return <FishOverview enterprise={enterprise} />
    case 'crop_annual':
    case 'crop_perennial':  return <CropOverview enterprise={enterprise} />
    default:
      return (
        <div className="p-4 text-center text-gray-400 py-12">
          <p className="text-4xl mb-2">{TYPE_ICON[enterprise.enterpriseType]}</p>
          <p className="text-sm text-gray-500">
            Detailed analytics for {TYPE_LABEL[enterprise.enterpriseType]} coming soon
          </p>
        </div>
      )
  }
}

// ── Duration label ─────────────────────────────────────────────────────────────

function durationLabel(startDate: string, endDate?: string | null): string {
  const from = new Date(startDate)
  const to   = endDate ? new Date(endDate) : new Date()
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
  if (days < 7)   return `${days}d`
  if (days < 60)  return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EnterpriseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('Overview')

  const enterprise = useEnterprise(id)

  if (enterprise === undefined) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50 text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (!enterprise) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50 text-gray-500 text-sm">
        Enterprise not found.
      </div>
    )
  }

  const age = durationLabel(enterprise.startDate, enterprise.actualEndDate)

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-0 safe-top">
        <div className="flex items-center gap-3 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform flex-shrink-0"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{TYPE_ICON[enterprise.enterpriseType]}</span>
              <p className="text-white font-semibold text-lg leading-tight truncate">{enterprise.name}</p>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[enterprise.status]}`}>
                {enterprise.status}
              </span>
              <span className="text-white/60 text-xs">{TYPE_LABEL[enterprise.enterpriseType]}</span>
              <span className="text-white/40 text-xs">· {age}</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-primary-500 -mx-4 px-4 gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-white border-white'
                  : 'text-white/60 border-transparent hover:text-white/80'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'Overview'  && <Overview enterprise={enterprise} />}
        {activeTab === 'Records'   && <EnterpriseRecords enterprise={enterprise} />}
        {activeTab === 'Analysis'  && <EnterpriseAnalysis enterprise={enterprise} />}
        {activeTab === 'Financial' && <EnterpriseFinancials enterprise={enterprise} />}
        {activeTab === 'Health'    && <EnterpriseHealthTab enterprise={enterprise} />}
      </div>
    </div>
  )
}
