import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { AlertRuleId, AlertThresholds } from '../../core/config/constants'
import { useUIStore } from '../../stores/ui-store'

// ── Rule definitions ──────────────────────────────────────────────────────────

interface RuleDef {
  id: string
  label: string
  description: string
}

interface RuleGroup {
  label: string
  rules: RuleDef[]
}

const RULE_GROUPS: RuleGroup[] = [
  {
    label: 'Layer Flock',
    rules: [
      {
        id: AlertRuleId.layerProductionDrop,
        label: 'HDP Production Drop',
        description: `Alert when HDP drops ≥${AlertThresholds.layerProductionDropPts}% in one day`,
      },
      {
        id: AlertRuleId.layerMortalitySpike,
        label: 'Mortality Spike',
        description: `Alert when ≥${AlertThresholds.layerMortalityMinBirds} birds die in one day`,
      },
      {
        id: AlertRuleId.layerFeedAnomaly,
        label: 'Feed Consumption Anomaly',
        description: `Alert when feed deviates ≥${AlertThresholds.layerFeedDeviationPct * 100}% from 7-day average`,
      },
    ],
  },
  {
    label: 'Broilers',
    rules: [
      {
        id: AlertRuleId.broilerMortalitySpike,
        label: 'Mortality Spike',
        description: `Alert when ≥${AlertThresholds.broilerMortalityMinBirds} birds die in one day`,
      },
      {
        id: AlertRuleId.broilerWeightBehind,
        label: 'Weight Behind Standard',
        description: `Alert when weight is >${AlertThresholds.broilerWeightBehindPct * 100}% below Ross 308 standard`,
      },
      {
        id: AlertRuleId.broilerNearMarket,
        label: 'Near Market Date',
        description: `Alert ${AlertThresholds.broilerNearMarketDays} days before expected market date`,
      },
    ],
  },
  {
    label: 'Fishery',
    rules: [
      {
        id: AlertRuleId.fishDoCritical,
        label: 'Critical Dissolved Oxygen',
        description: `Alert when DO < ${AlertThresholds.fishDoLow} mg/L`,
      },
      {
        id: AlertRuleId.fishAmmoniaHigh,
        label: 'High Ammonia',
        description: `Alert when ammonia > ${AlertThresholds.fishAmmoniaHigh} mg/L`,
      },
      {
        id: AlertRuleId.fishPhOutOfRange,
        label: 'pH Out of Range',
        description: `Alert when pH < ${AlertThresholds.fishPhMin} or > ${AlertThresholds.fishPhMax}`,
      },
      {
        id: AlertRuleId.fishTempExtreme,
        label: 'Extreme Temperature',
        description: `Alert when water temp < ${AlertThresholds.fishTempMin}°C or > ${AlertThresholds.fishTempMax}°C`,
      },
    ],
  },
  {
    label: 'Inventory',
    rules: [
      {
        id: 'inv_low_stock',
        label: 'Low Stock Alert',
        description: 'Alert when any item stock falls to or below its reorder point',
      },
      {
        id: 'inv_projected_stockout',
        label: 'Projected Stockout',
        description: `Alert when stock is projected to run out within ${AlertThresholds.invProjectedStockoutDays} days`,
      },
    ],
  },
  {
    label: 'Financial',
    rules: [
      {
        id: AlertRuleId.finCostExceedingRevenue,
        label: 'Cost Exceeding Revenue',
        description: `Alert when month-to-date costs reach ${AlertThresholds.finCostPct * 100}% of income`,
      },
    ],
  },
  {
    label: 'Operational',
    rules: [
      {
        id: 'op_batch_nearing_end',
        label: 'Batch Nearing End',
        description: `Alert ${AlertThresholds.opBatchNearingEndDays} days before expected end date`,
      },
    ],
  },
]

// ── localStorage helpers ──────────────────────────────────────────────────────

function ruleKey(id: string) {
  return `alert_rule_${id}_enabled`
}

function getRuleEnabled(id: string): boolean {
  const stored = localStorage.getItem(ruleKey(id))
  return stored === null ? true : stored === 'true'
}

function setRuleEnabled(id: string, enabled: boolean) {
  localStorage.setItem(ruleKey(id), String(enabled))
}

function resetAllRules() {
  RULE_GROUPS.flatMap(g => g.rules).forEach(r => {
    localStorage.removeItem(ruleKey(r.id))
  })
}

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-primary-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AlertSettingsPage() {
  const navigate = useNavigate()
  const addToast = useUIStore(s => s.addToast)

  // Track per-rule enabled state in component state (initialised from localStorage)
  const [ruleStates, setRuleStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    RULE_GROUPS.flatMap(g => g.rules).forEach(r => {
      initial[r.id] = getRuleEnabled(r.id)
    })
    return initial
  })

  const handleToggle = (ruleId: string, enabled: boolean) => {
    setRuleEnabled(ruleId, enabled)
    setRuleStates(prev => ({ ...prev, [ruleId]: enabled }))
  }

  const handleResetDefaults = () => {
    resetAllRules()
    const reset: Record<string, boolean> = {}
    RULE_GROUPS.flatMap(g => g.rules).forEach(r => { reset[r.id] = true })
    setRuleStates(reset)
    addToast({ message: 'Alert rules reset to defaults', type: 'success' })
  }

  // Notification permission
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied',
  )

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    if (result === 'granted') {
      addToast({ message: 'Notifications enabled', type: 'success' })
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 safe-top">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Alert Settings</h1>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1 text-sm text-gray-500 font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 fade-in">
        {/* Notification permission */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Push Notifications</p>
          <p className="text-xs text-gray-500 mb-3">
            Allow browser notifications for critical alerts when the app is open.
          </p>
          {notifPermission === 'granted' ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              Notifications enabled
            </div>
          ) : notifPermission === 'denied' ? (
            <p className="text-xs text-red-500">
              Notifications are blocked. Enable them in your browser settings.
            </p>
          ) : (
            <button
              onClick={requestNotificationPermission}
              className="bg-primary-600 text-white rounded-xl px-4 py-2 text-sm font-semibold active:scale-95 transition-transform"
            >
              Enable Notifications
            </button>
          )}
        </div>

        {/* Alert rule groups */}
        {RULE_GROUPS.map(group => (
          <div key={group.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {group.rules.map(rule => (
                <div key={rule.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{rule.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.description}</p>
                  </div>
                  <Toggle
                    enabled={ruleStates[rule.id] ?? true}
                    onChange={v => handleToggle(rule.id, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Note about threshold editing */}
        <p className="text-xs text-gray-400 text-center px-4 pb-4">
          Alert thresholds are pre-configured for optimal farm management. Toggle rules on/off above.
        </p>
      </div>
    </div>
  )
}
