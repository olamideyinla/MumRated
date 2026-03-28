import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PenLine, FileText, Package, MoreHorizontal,
  Building2, CheckSquare, Eye, X,
  Stethoscope, HardHat, Wallet, Lightbulb, Users, ClipboardList,
  Bell, BellRing,
  type LucideIcon,
} from 'lucide-react'
import { useUnreadHighCriticalCount, useAlerts } from '../../core/database/hooks/useAlerts'
import { useAuthStore } from '../../stores/auth-store'
import { alertEngine } from '../../core/services/alert-engine'
import { initSyncTriggers } from '../../core/sync/sync-triggers'
import { initReminderScheduler } from '../../core/services/worker-reminder-engine'
import { SyncStatusIndicator } from '../../features/sync/SyncStatusIndicator'
import InstallPrompt from '../components/InstallPrompt'
import { UpdateBanner } from '../components/UpdateBanner'
import { OfflineBanner } from '../components/OfflineBanner'
import type { UserRole } from '../../shared/types'

// ── Sync runner ───────────────────────────────────────────────────────────────

function SyncRunner() {
  useEffect(() => {
    const cleanup = initSyncTriggers()
    return cleanup
  }, [])
  return null
}

// ── Reminder engine runner (workers only) ─────────────────────────────────────

function ReminderEngineRunner() {
  const appUser = useAuthStore(s => s.appUser)
  useEffect(() => {
    if (appUser?.role !== 'worker') return
    const scheduler = initReminderScheduler(appUser.id)
    return () => scheduler.stop()
  }, [appUser?.id, appUser?.role])
  return null
}

// ── Alert engine runner ────────────────────────────────────────────────────────

const NOTIFIED_KEY = 'agri_last_notified_ts'

function AlertEngineRunner() {
  const appUser = useAuthStore(s => s.appUser)
  const alerts  = useAlerts() ?? []
  const notifiedRef = useRef<number>(
    parseInt(localStorage.getItem(NOTIFIED_KEY) ?? '0', 10),
  )

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const orgId = appUser?.organizationId
    if (!orgId) return
    const run = () => alertEngine.checkAlerts(orgId).catch(console.error)
    const initialTimer = setTimeout(run, 5_000)
    const interval     = setInterval(run, 30 * 60 * 1_000)
    return () => { clearTimeout(initialTimer); clearInterval(interval) }
  }, [appUser?.organizationId])

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const lastTs = notifiedRef.current
    const newCritical = alerts.filter(
      a =>
        (a.severity === 'critical' || a.severity === 'high') &&
        !a.isDismissed &&
        new Date(a.createdAt).getTime() > lastTs,
    )
    if (newCritical.length === 0) return
    const now = Date.now()
    notifiedRef.current = now
    localStorage.setItem(NOTIFIED_KEY, String(now))
    if (newCritical.length === 1) {
      new Notification('AgriManagerX Alert', {
        body: newCritical[0].message, icon: '/icon-192.png', tag: newCritical[0].id,
      })
    } else {
      new Notification(`AgriManagerX — ${newCritical.length} new alerts`, {
        body: newCritical.map(a => `• ${a.message}`).join('\n'),
        icon: '/icon-192.png', tag: 'agri-bundle',
      })
    }
  }, [alerts])

  return null
}

// ── Nav items ──────────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  alertBadge?: boolean
  dividerBefore?: boolean
}

// Bottom nav — mobile, stays compact
const BOTTOM_NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard', alertBadge: true },
    { to: '/daily-entry', icon: PenLine,          label: 'Entry' },
    { to: '/reports',     icon: FileText,          label: 'Reports' },
    { to: '/inventory',   icon: Package,           label: 'Inventory' },
    { to: '/more',        icon: MoreHorizontal,    label: 'More' },
  ],
  manager: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard', alertBadge: true },
    { to: '/daily-entry', icon: PenLine,          label: 'Entry' },
    { to: '/reports',     icon: FileText,          label: 'Reports' },
    { to: '/inventory',   icon: Package,           label: 'Inventory' },
    { to: '/more',        icon: MoreHorizontal,    label: 'More' },
  ],
  supervisor: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard', alertBadge: true },
    { to: '/daily-entry', icon: PenLine,          label: 'Entry' },
    { to: '/enterprises', icon: Building2,         label: 'Records' },
    { to: '/more',        icon: MoreHorizontal,    label: 'More' },
  ],
  worker: [
    { to: '/worker/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/worker-entry', icon: PenLine,     label: 'Entry' },
    { to: '/enterprises',  icon: Building2,   label: 'Records' },
  ],
  viewer: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', alertBadge: true },
    { to: '/reports',   icon: FileText,         label: 'Reports' },
    { to: '/more',      icon: MoreHorizontal,   label: 'More' },
  ],
}

// Sidebar nav — desktop, expanded per role
const SIDEBAR_NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner: [
    { to: '/dashboard',               icon: LayoutDashboard, label: 'Dashboard',      alertBadge: true },
    { to: '/daily-entry',             icon: PenLine,          label: 'Daily Entry' },
    { to: '/enterprises',             icon: Building2,        label: 'Enterprises',    dividerBefore: true },
    { to: '/financials',              icon: Wallet,           label: 'Financials' },
    { to: '/reports',                 icon: FileText,         label: 'Reports' },
    { to: '/inventory',               icon: Package,          label: 'Inventory' },
    { to: '/health',                  icon: Stethoscope,      label: 'Health Schedule' },
    { to: '/labor',                   icon: HardHat,          label: 'Labour' },
    { to: '/decision',                icon: Lightbulb,        label: 'Decision Tools', dividerBefore: true },
    { to: '/team',                    icon: Users,            label: 'Team' },
    { to: '/settings/task-templates', icon: ClipboardList,    label: 'Task Templates' },
    { to: '/alerts',                  icon: Bell,             label: 'Alerts',         dividerBefore: true },
    { to: '/settings/reminders',      icon: BellRing,         label: 'Reminders' },
    { to: '/more',                    icon: MoreHorizontal,   label: 'More',           dividerBefore: true },
  ],
  manager: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',      alertBadge: true },
    { to: '/daily-entry', icon: PenLine,          label: 'Daily Entry' },
    { to: '/enterprises', icon: Building2,        label: 'Enterprises',    dividerBefore: true },
    { to: '/financials',  icon: Wallet,           label: 'Financials' },
    { to: '/reports',     icon: FileText,         label: 'Reports' },
    { to: '/inventory',   icon: Package,          label: 'Inventory' },
    { to: '/health',      icon: Stethoscope,      label: 'Health Schedule' },
    { to: '/labor',       icon: HardHat,          label: 'Labour' },
    { to: '/decision',    icon: Lightbulb,        label: 'Decision Tools', dividerBefore: true },
    { to: '/alerts',      icon: Bell,             label: 'Alerts',         dividerBefore: true },
    { to: '/settings/reminders', icon: BellRing,  label: 'Reminders' },
    { to: '/more',        icon: MoreHorizontal,   label: 'More',           dividerBefore: true },
  ],
  supervisor: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',      alertBadge: true },
    { to: '/daily-entry', icon: PenLine,          label: 'Daily Entry' },
    { to: '/enterprises', icon: Building2,        label: 'Records',        dividerBefore: true },
    { to: '/health',      icon: Stethoscope,      label: 'Health Schedule' },
    { to: '/labor',       icon: HardHat,          label: 'Labour' },
    { to: '/alerts',      icon: Bell,             label: 'Alerts',         dividerBefore: true },
    { to: '/settings/reminders', icon: BellRing,  label: 'Reminders' },
    { to: '/more',        icon: MoreHorizontal,   label: 'More',           dividerBefore: true },
  ],
  worker: [
    { to: '/worker/tasks',       icon: CheckSquare, label: 'Tasks' },
    { to: '/worker-entry',       icon: PenLine,     label: 'Entry' },
    { to: '/enterprises',        icon: Building2,   label: 'Records' },
    { to: '/settings/reminders', icon: BellRing,    label: 'Reminders',    dividerBefore: true },
  ],
  viewer: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', alertBadge: true },
    { to: '/reports',   icon: FileText,         label: 'Reports' },
    { to: '/alerts',    icon: Bell,             label: 'Alerts',    dividerBefore: true },
    { to: '/more',      icon: MoreHorizontal,   label: 'More' },
  ],
}

function NavItems({ items, unreadCount, vertical = false }: {
  items: NavItem[]
  unreadCount: number
  vertical?: boolean
}) {
  return (
    <>
      {items.map(({ to, icon: Icon, label, alertBadge, dividerBefore }) => (
        <div key={to}>
          {vertical && dividerBefore && (
            <hr className="my-1 mx-4 border-gray-100 dark:border-gray-700" />
          )}
          <NavLink
            to={to}
            className={({ isActive }) =>
              vertical
                ? `flex items-center gap-3 px-4 py-2.5 rounded-xl mx-2 transition-colors ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`
                : `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                    isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                  }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className={`w-5 h-5 ${isActive && !vertical ? 'stroke-[2.5]' : ''}`} />
                  {alertBadge && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className={vertical ? 'text-sm font-medium' : 'text-[10px] font-medium leading-none'}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        </div>
      ))}
    </>
  )
}

// ── View-As banner ─────────────────────────────────────────────────────────────

function ViewAsBanner() {
  const viewingAs    = useAuthStore(s => s.viewingAs)
  const setViewingAs = useAuthStore(s => s.setViewingAs)
  const navigate     = useNavigate()

  if (!viewingAs) return null

  const ROLE_LABEL: Record<UserRole, string> = {
    owner: 'Owner', manager: 'Manager', supervisor: 'Supervisor',
    worker: 'Worker', viewer: 'Viewer',
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white text-xs font-medium z-40 lg:ml-64">
      <Eye size={13} className="shrink-0" />
      <span className="flex-1 truncate">
        Viewing as <span className="font-bold">{viewingAs.fullName}</span>
        {' '}· {ROLE_LABEL[viewingAs.role]}
      </span>
      <button
        onClick={() => { setViewingAs(null); navigate('/dashboard') }}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-md px-2 py-0.5 transition-colors shrink-0"
      >
        <X size={11} />
        Exit
      </button>
    </div>
  )
}

function BottomNav() {
  const role        = useAuthStore(s => (s.viewingAs ?? s.appUser)?.role ?? 'owner')
  const unreadCount = useUnreadHighCriticalCount() ?? 0
  const navItems    = BOTTOM_NAV_BY_ROLE[role]

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[var(--bg-surface)] border-t border-gray-200 dark:border-gray-700 z-50 lg:hidden"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <div className="flex">
        <NavItems items={navItems} unreadCount={unreadCount} />
      </div>
    </nav>
  )
}

function Sidebar() {
  const role        = useAuthStore(s => (s.viewingAs ?? s.appUser)?.role ?? 'owner')
  const unreadCount = useUnreadHighCriticalCount() ?? 0
  const navItems    = SIDEBAR_NAV_BY_ROLE[role]

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[var(--bg-surface)] z-30">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
        <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
          AgriManager<span
            className="font-black italic"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 60%, #ef4444 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block',
              transform: 'scaleX(1.1)',
              transformOrigin: 'left',
            }}
          >X</span>
        </span>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-4 space-y-0.5">
        <NavItems items={navItems} unreadCount={unreadCount} vertical />
      </nav>
    </aside>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export function MobileShell() {
  return (
    <div className="flex flex-col h-dvh bg-gray-50 dark:bg-[var(--bg-base)] lg:flex-row">
      <SyncRunner />
      <AlertEngineRunner />
      <ReminderEngineRunner />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:ml-64">
        <UpdateBanner />
        <InstallPrompt />
        <OfflineBanner />
        <ViewAsBanner />
        <div className="flex justify-end border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[var(--bg-surface)]">
          <SyncStatusIndicator />
        </div>
        <main className="flex-1 overflow-y-auto content-with-nav lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
