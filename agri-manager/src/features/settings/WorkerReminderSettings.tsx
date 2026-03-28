import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  loadReminderConfig,
  saveReminderConfig,
  type ReminderConfig,
} from '../../core/services/worker-reminder-engine'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  )
}

export default function WorkerReminderSettings() {
  const navigate = useNavigate()
  const [cfg, setCfg] = useState<ReminderConfig>(loadReminderConfig)
  const [saved, setSaved] = useState(false)

  const update = <K extends keyof ReminderConfig>(k: K, v: ReminderConfig[K]) => {
    setCfg(c => ({ ...c, [k]: v }))
    setSaved(false)
  }

  const toggleDay = (d: number) => {
    const days = cfg.workDays.includes(d)
      ? cfg.workDays.filter(x => x !== d)
      : [...cfg.workDays, d]
    update('workDays', days)
  }

  const handleSave = () => {
    saveReminderConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      await Notification.requestPermission()
    }
  }

  const notifGranted = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission === 'granted'
    : false

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 px-4 pt-3 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1">Reminder Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Notification permission */}
        {!notifGranted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-700 mb-1">Notifications not enabled</p>
            <p className="text-xs text-amber-600 mb-3">
              Allow notifications to receive task reminders on this device.
            </p>
            <button
              onClick={() => void handleRequestPermission()}
              className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Enable Notifications
            </button>
          </div>
        )}

        {/* Enable toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Task Reminders</p>
              <p className="text-xs text-gray-400 mt-0.5">Receive notifications for daily tasks</p>
            </div>
            <button
              onClick={() => update('enabled', !cfg.enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                cfg.enabled ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                cfg.enabled ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>

        {cfg.enabled && (
          <>
            {/* Reminder times */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Reminder Times</p>
              <div className="divide-y divide-gray-50">
                <TimeInput label="☀️ Morning briefing" value={cfg.morningTime} onChange={v => update('morningTime', v)} />
                <TimeInput label="🌤️ Midday check-in" value={cfg.middayTime}  onChange={v => update('middayTime', v)} />
                <TimeInput label="🌙 Evening wrap-up"  value={cfg.eveningTime} onChange={v => update('eveningTime', v)} />
              </div>
            </div>

            {/* Work days */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Work Days</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      cfg.workDays.includes(idx)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {label.charAt(0)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Reminders will only fire on selected days
              </p>
            </div>

            {/* Max nudges */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Max nudges per day</p>
                <span className="text-lg font-bold text-primary-700">{cfg.maxNudges}</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                value={cfg.maxNudges}
                onChange={e => update('maxNudges', Number(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Off</span>
                <span>6×</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Overdue-task nudges are sent every 30 minutes up to this limit
              </p>
            </div>
          </>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
          }`}
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>

        <div className="h-6" />
      </div>
    </div>
  )
}
