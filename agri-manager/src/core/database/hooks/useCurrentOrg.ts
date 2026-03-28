import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../../stores/auth-store'

export function useCurrentOrg() {
  const userId = useAuthStore(s => s.userId)
  return useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.appUsers.get(userId)
    if (!user) return null
    return db.organizations.get(user.organizationId)
  }, [userId])
}
