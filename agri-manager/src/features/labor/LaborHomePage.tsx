import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '../../stores/auth-store'
import { useWorkers, useMonthlyLaborCost } from '../../core/database/hooks/use-labor'
import { AttendanceTab } from './tabs/AttendanceTab'
import { CasualLaborTab } from './tabs/CasualLaborTab'
import { PayrollTab } from './tabs/PayrollTab'
import { WorkersTab } from './tabs/WorkersTab'

type Tab = 'attendance' | 'casual' | 'payroll' | 'workers'

const TABS: { id: Tab; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'casual',     label: 'Casual' },
  { id: 'payroll',    label: 'Payroll' },
  { id: 'workers',    label: 'Workers' },
]

export default function LaborHomePage() {
  const navigate = useNavigate()
  const appUser  = useAuthStore(s => s.appUser)
  const orgId    = appUser?.organizationId
  const now      = new Date()

  const workers      = useWorkers(orgId)
  const monthlyCost  = useMonthlyLaborCost(orgId, now.getFullYear(), now.getMonth() + 1)

  const permanentCount = workers?.filter(w => w.workerType === 'permanent' && w.status === 'active').length ?? 0
  const casualCount    = workers?.filter(w => w.workerType === 'casual' && w.status === 'active').length ?? 0

  const [activeTab, setActiveTab] = useState<Tab>('attendance')

  if (!orgId) {
    return (
      <div className="h-dvh flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-3 safe-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg">Labor</h1>
          </div>
        </div>

        {/* Summary row */}
        <div className="mt-2 flex items-center gap-3 text-white/80 text-xs">
          <span>{permanentCount} permanent</span>
          <span>·</span>
          <span>{casualCount} casual</span>
          {monthlyCost != null && monthlyCost > 0 && (
            <>
              <span>·</span>
              <span className="font-semibold text-white">${monthlyCost.toFixed(0)} this month</span>
            </>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex mt-3 border-b border-primary-500">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'attendance' && <AttendanceTab orgId={orgId} />}
        {activeTab === 'casual'     && <CasualLaborTab orgId={orgId} />}
        {activeTab === 'payroll'    && <PayrollTab orgId={orgId} />}
        {activeTab === 'workers'    && <WorkersTab orgId={orgId} />}
      </div>
    </div>
  )
}
