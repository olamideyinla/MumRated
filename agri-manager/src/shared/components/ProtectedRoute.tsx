import { Navigate } from 'react-router-dom'
import { Wheat } from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'
import type { UserRole } from '../../shared/types'

function LoadingScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-primary-700">
      <div className="text-center">
        <Wheat size={48} className="mx-auto mb-3 text-accent animate-pulse" />
        <p className="text-sm text-primary-200">Loading…</p>
      </div>
    </div>
  )
}

interface ProtectedRouteProps {
  children: React.ReactNode
  /** If provided, only users with one of these roles can access the route. Others are redirected to /dashboard. */
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const isLoading = useAuthStore(s => s.isLoading)
  const appUser = useAuthStore(s => s.appUser)

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/auth/welcome" replace />
  if (allowedRoles && appUser && !allowedRoles.includes(appUser.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const isLoading = useAuthStore(s => s.isLoading)

  if (isLoading) return <LoadingScreen />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
