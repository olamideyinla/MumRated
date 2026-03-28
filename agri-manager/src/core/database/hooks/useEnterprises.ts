import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'

export function useEnterprises(status?: 'active' | 'completed' | 'suspended') {
  const userId = useAuthStore(s => s.userId)

  return useLiveQuery(async () => {
    if (!userId) return []
    const user = await db.appUsers.get(userId)
    if (!user) return []

    const infras = await db.infrastructures
      .where('farmLocationId')
      .anyOf(
        await db.farmLocations
          .where('organizationId').equals(user.organizationId)
          .primaryKeys()
      )
      .toArray()

    const infraIds = infras.map(i => i.id)
    let query = db.enterpriseInstances.where('infrastructureId').anyOf(infraIds)
    const results = await query.toArray()
    return status ? results.filter(e => e.status === status) : results
  }, [userId, status])
}
