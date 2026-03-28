import { useLiveQuery } from 'dexie-react-hooks'
import { useAuthStore } from '../../stores/auth-store'
import { db } from '../../core/database/db'
import {
  hasPermission,
  getVisibleEnterprises,
  type Permission,
} from '../../core/services/permissions'
import type { EnterpriseInstance } from '../types'

/**
 * Returns true if the current user has the given permission.
 * Re-renders when the appUser changes.
 */
export function useHasPermission(permission: Permission): boolean {
  const appUser = useAuthStore(s => s.appUser)
  if (!appUser) return false
  return hasPermission(appUser, permission)
}

/**
 * Returns only the EnterpriseInstances the current user can access,
 * filtered by their role and location/infrastructure assignments.
 * Excludes completed/cancelled enterprises.
 */
export function useVisibleEnterprises(statusFilter?: EnterpriseInstance['status']): EnterpriseInstance[] | undefined {
  const appUser = useAuthStore(s => s.appUser)

  return useLiveQuery(async () => {
    if (!appUser) return []

    // Get all org infrastructures to build the infra→location map
    const locations = await db.farmLocations
      .where('organizationId').equals(appUser.organizationId)
      .toArray()
    const locationIds = new Set(locations.map(l => l.id))

    const allInfras = await db.infrastructures.toArray()
    const orgInfras = allInfras.filter(i => locationIds.has(i.farmLocationId))
    const infraToLocation = new Map(orgInfras.map(i => [i.id, i.farmLocationId]))
    const orgInfraIds = orgInfras.map(i => i.id)

    if (orgInfraIds.length === 0) return []

    let enterprises = await db.enterpriseInstances
      .where('infrastructureId').anyOf(orgInfraIds)
      .toArray()

    if (statusFilter) {
      enterprises = enterprises.filter(e => e.status === statusFilter)
    }

    return getVisibleEnterprises(appUser, enterprises, infraToLocation)
  }, [appUser?.id, appUser?.role, appUser?.assignedFarmLocationIds, appUser?.assignedInfrastructureIds, statusFilter])
}
