import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../core/config/supabase'
import { useAuthStore } from '../../stores/auth-store'
import { useUIStore } from '../../stores/ui-store'
import type { Theme, FontSize } from '../../stores/ui-store'
import { Bell, BarChart2, Building2, LogOut, ChevronRight, RefreshCw, Users, ClipboardList, BrainCircuit, Database, Stethoscope, Users2, BellRing } from 'lucide-react'
import { PermissionGate } from '../../shared/components/PermissionGate'
import type { UserRole } from '../../shared/types'

// Paths that appear in the desktop sidebar per role — hide from More on lg+ screens
const SIDEBAR_PATHS_BY_ROLE: Record<UserRole, ReadonlySet<string>> = {
  owner:      new Set(['/enterprises', '/financials', '/reports', '/inventory', '/health', '/labor', '/decision', '/team', '/settings/task-templates', '/alerts', '/settings/reminders']),
  manager:    new Set(['/enterprises', '/financials', '/reports', '/inventory', '/health', '/labor', '/decision', '/alerts', '/settings/reminders']),
  supervisor: new Set(['/enterprises', '/health', '/labor', '/alerts', '/settings/reminders']),
  worker:     new Set(['/enterprises', '/settings/reminders']),
  viewer:     new Set(['/reports', '/alerts']),
}

const ROLE_COLORS: Record<string, string> = {
  owner:      'bg-amber-100 text-amber-800',
  manager:    'bg-blue-100 text-blue-800',
  supervisor: 'bg-purple-100 text-purple-800',
  worker:     'bg-green-100 text-green-800',
  viewer:     'bg-gray-100 text-gray-700',
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light',  label: 'Light'  },
  { value: 'dark',   label: 'Dark'   },
]

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large',  label: 'Large'  },
]

export default function MorePage() {
  const navigate  = useNavigate()
  const appUser   = useAuthStore(s => s.appUser)
  const signOut   = useAuthStore(s => s.signOut)
  const theme     = useUIStore(s => s.theme)
  const setTheme  = useUIStore(s => s.setTheme)
  const fontSize  = useUIStore(s => s.fontSize)
  const setFontSize = useUIStore(s => s.setFontSize)

  // Track whether the sidebar is visible (lg breakpoint = 1024px)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    signOut()
    navigate('/sign-in')
  }

  const allItems = [
    { icon: BrainCircuit,  label: 'Decision Tools',  to: '/decision',                  permission: null },
    { icon: Stethoscope,   label: 'Health Schedule', to: '/health',                    permission: null },
    { icon: Users2,        label: 'Labor',           to: '/labor',                     permission: null },
    { icon: ClipboardList, label: 'Task Templates',  to: '/settings/task-templates',   permission: 'users:manage' as const },
    { icon: BellRing,      label: 'Reminders',       to: '/settings/reminders',        permission: null },
    { icon: Bell,          label: 'Alerts',           to: '/alerts',                    permission: null },
    { icon: Building2,     label: 'Enterprises',      to: '/enterprises',               permission: null },
    { icon: BarChart2,     label: 'Financials',       to: '/financials',                permission: 'financial:read' as const },
    { icon: Database,      label: 'Data Management',  to: '/settings/data-management',  permission: null },
    { icon: RefreshCw,     label: 'Sync',             to: '/sync',                      permission: null },
    { icon: Users,         label: 'Team',             to: '/team',                      permission: 'users:manage' as const },
    { icon: ClipboardList, label: 'Activity Log',     to: '/settings/activity-log',     permission: 'users:manage' as const },
  ]

  // On desktop the sidebar is visible, so hide items already shown there
  const sidebarPaths = isDesktop && appUser
    ? SIDEBAR_PATHS_BY_ROLE[appUser.role] ?? new Set<string>()
    : new Set<string>()
  const items = allItems.filter(i => !sidebarPaths.has(i.to))

  return (
    <div className="px-4 pt-4 pb-8 fade-in space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">More</h1>

      {/* Profile */}
      {appUser && (
        <div className="card dark:bg-[var(--bg-card)] dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
              <span className="text-primary-700 dark:text-primary-300 font-bold text-base">
                {appUser.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{appUser.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{appUser.phone ?? appUser.email ?? ''}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${ROLE_COLORS[appUser.role] ?? 'bg-gray-100 text-gray-700'}`}>
              {appUser.role}
            </span>
          </div>
        </div>
      )}

      {/* Appearance */}
      <div className="card dark:bg-[var(--bg-card)] dark:border-gray-700">
        <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Appearance
        </h2>

        <div className="mb-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</p>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            {THEMES.map(t => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  theme === t.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-[var(--bg-card)] text-gray-600 dark:text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Text Size</p>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            {FONT_SIZES.map(s => (
              <button
                key={s.value}
                onClick={() => setFontSize(s.value)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  fontSize === s.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-[var(--bg-card)] text-gray-600 dark:text-gray-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="card dark:bg-[var(--bg-card)] dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {items.map(({ icon: Icon, label, to, permission }) => {
          const btn = (
            <button key={to} onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 py-3 text-left">
              <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )
          if (permission) {
            return (
              <PermissionGate key={to} permission={permission}>
                {btn}
              </PermissionGate>
            )
          }
          return btn
        })}
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 py-3 text-left text-red-600">
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  )
}
