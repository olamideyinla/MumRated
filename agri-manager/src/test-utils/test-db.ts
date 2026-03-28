import { db } from '../core/database/db'
import {
  createOrganization,
  createFarmLocation,
  createInfrastructure,
  createAppUser,
} from './db-factory'

export * from './db-factory'

/** Seed a full org hierarchy (org → location → infra → user). Returns all created entities. */
export async function seedOrgHierarchy() {
  const org = createOrganization()
  const loc = createFarmLocation(org.id)
  const infra = createInfrastructure(loc.id)
  const userId = crypto.randomUUID()
  const user = createAppUser(org.id, userId)

  await db.organizations.put(org)
  await db.farmLocations.put(loc)
  await db.infrastructures.put(infra)
  await db.appUsers.put(user)

  return { org, loc, infra, user }
}
