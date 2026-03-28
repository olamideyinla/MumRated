import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'
import type { EnterpriseType, EnterpriseInstance } from '../../../shared/types'

/** Fetches infra IDs belonging to the current user's org */
async function getOrgInfraIds(userId: string): Promise<string[]> {
  const user = await db.appUsers.get(userId)
  if (!user) return []
  const locations = await db.farmLocations
    .where('organizationId').equals(user.organizationId).toArray()
  const locationIds = locations.map(l => l.id)
  const infras = await db.infrastructures
    .where('farmLocationId').anyOf(locationIds).toArray()
  return infras.map(i => i.id)
}

/** All active enterprise instances for the current user's organization */
export function useActiveEnterprises(): EnterpriseInstance[] | undefined {
  const userId = useAuthStore(s => s.user?.id)
  return useLiveQuery(async () => {
    if (!userId) return []
    const infraIds = await getOrgInfraIds(userId)
    if (!infraIds.length) return []
    return db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => e.status === 'active')
      .toArray()
  }, [userId])
}

/** Single enterprise instance, live-updating */
export function useEnterprise(id: string | undefined): EnterpriseInstance | undefined {
  return useLiveQuery(
    () => (id ? db.enterpriseInstances.get(id) : undefined),
    [id],
  )
}

/** All enterprise instances of a given type within the user's org */
export function useEnterprisesByType(type: EnterpriseType): EnterpriseInstance[] | undefined {
  const userId = useAuthStore(s => s.user?.id)
  return useLiveQuery(async () => {
    if (!userId) return []
    const infraIds = await getOrgInfraIds(userId)
    if (!infraIds.length) return []
    return db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds)
      .filter(e => e.enterpriseType === type)
      .toArray()
  }, [userId, type])
}

/** All enterprise instances within a specific farm location */
export function useEnterprisesByLocation(locationId: string | undefined): EnterpriseInstance[] | undefined {
  return useLiveQuery(async () => {
    if (!locationId) return []
    const infras = await db.infrastructures
      .where('farmLocationId').equals(locationId).toArray()
    const infraIds = infras.map(i => i.id)
    if (!infraIds.length) return []
    return db.enterpriseInstances
      .where('infrastructureId').anyOf(infraIds).toArray()
  }, [locationId])
}
