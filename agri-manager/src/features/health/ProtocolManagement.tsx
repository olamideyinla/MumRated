import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import { useHealthProtocols } from '../../core/database/hooks/use-health'
import { seedDefaultProtocols } from '../../core/services/health-scheduler'
import { db } from '../../core/database/db'
import { EVENT_TYPE_CONFIG } from './health-config'
import type { HealthProtocol } from '../../shared/types'

// ── Protocol card ─────────────────────────────────────────────────────────────

function ProtocolCard({ protocol }: { protocol: HealthProtocol }) {
  const [expanded, setExpanded] = useState(false)
  const typeLabel = protocol.enterpriseType.replace(/_/g, ' ')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{protocol.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{typeLabel} · {protocol.events.length} events</p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && protocol.events.length > 0 && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {protocol.events
            .slice()
            .sort((a, b) => a.dayOffset - b.dayOffset)
            .map(evt => {
              const tc = EVENT_TYPE_CONFIG[evt.eventType] ?? EVENT_TYPE_CONFIG.other
              return (
                <div key={evt.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-tight">{evt.name}</p>
                    {evt.product && (
                      <p className="text-xs text-gray-400 mt-0.5">{evt.product}{evt.route ? ` · ${evt.route}` : ''}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">Day {evt.dayOffset}</span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProtocolManagement() {
  const navigate   = useNavigate()
  const appUser    = useAuthStore(s => s.appUser)
  const orgId      = appUser?.organizationId

  const protocols  = useHealthProtocols(orgId)
  const [resetting, setResetting] = useState(false)

  const handleResetDefaults = async () => {
    if (!orgId) return
    setResetting(true)
    try {
      // Delete existing org protocols and re-seed
      const existing = await db.healthProtocols
        .where('organizationId').equals(orgId).toArray()
      const ids = existing.map(p => p.id)
      if (ids.length > 0) await db.healthProtocols.bulkDelete(ids)
      await seedDefaultProtocols(orgId)
    } finally {
      setResetting(false)
    }
  }

  // Group protocols by enterprise type
  const grouped = new Map<string, HealthProtocol[]>()
  for (const p of protocols ?? []) {
    const arr = grouped.get(p.enterpriseType) ?? []
    arr.push(p)
    grouped.set(p.enterpriseType, arr)
  }

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1">Health Protocols</h1>
          <button
            onClick={handleResetDefaults}
            disabled={resetting}
            className="flex items-center gap-1.5 text-white/80 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-primary-500/40 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={resetting ? 'animate-spin' : ''} />
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-6 pb-8">
        {protocols === undefined && (
          <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
        )}

        {protocols !== undefined && protocols.length === 0 && (
          <div className="text-center mt-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-semibold text-gray-700">No protocols yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Reset to load default vaccination schedules</p>
            <button
              onClick={handleResetDefaults}
              disabled={resetting}
              className="btn-primary text-sm px-6"
            >
              {resetting ? 'Loading…' : 'Load Defaults'}
            </button>
          </div>
        )}

        {[...grouped.entries()].map(([type, typeProtocols]) => (
          <div key={type}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 capitalize">
              {type.replace(/_/g, ' ')}
            </p>
            <div className="space-y-2">
              {typeProtocols.map(p => (
                <ProtocolCard key={p.id} protocol={p} />
              ))}
            </div>
          </div>
        ))}

        {/* Info note */}
        {protocols !== undefined && protocols.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              Protocols are automatically applied when you create a new enterprise. Use "Reset" to restore the default vaccination schedules.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
