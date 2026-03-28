import type { ReactNode } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { hasPermission, type Permission } from '../../core/services/permissions'

interface PermissionGateProps {
  permission: Permission
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Renders children only if the current user has the given permission.
 * Usage: <PermissionGate permission="financial:read"><FinancialCard /></PermissionGate>
 */
export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const appUser = useAuthStore(s => s.appUser)
  if (!appUser) return <>{fallback}</>
  return hasPermission(appUser, permission) ? <>{children}</> : <>{fallback}</>
}
