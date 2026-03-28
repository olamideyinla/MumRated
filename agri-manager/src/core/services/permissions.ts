import type { AppUser, EnterpriseInstance, UserRole } from '../../shared/types'

// ── Permission type ───────────────────────────────────────────────────────────

export type Permission =
  | 'data:create'
  | 'data:read'
  | 'data:update'
  | 'data:delete'
  | 'financial:read'
  | 'financial:create'
  | 'reports:view'
  | 'reports:export'
  | 'inventory:manage'
  | 'users:manage'
  | 'settings:manage'
  | 'all_locations'
  | 'assigned_locations_only'
  | 'assigned_infrastructure_only'

// ── Role → permission mapping ─────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'data:create', 'data:read', 'data:update', 'data:delete',
    'financial:read', 'financial:create',
    'reports:view', 'reports:export',
    'inventory:manage',
    'users:manage', 'settings:manage',
    'all_locations',
  ],
  manager: [
    'data:create', 'data:read', 'data:update', 'data:delete',
    'financial:read', 'financial:create',
    'reports:view', 'reports:export',
    'inventory:manage',
    'assigned_locations_only',
  ],
  supervisor: [
    'data:create', 'data:read', 'data:update',
    'assigned_infrastructure_only',
  ],
  worker: [
    'data:create', 'data:read',
    'assigned_infrastructure_only',
  ],
  viewer: [
    'data:read',
    'reports:view',
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function hasPermission(user: AppUser, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
}

/**
 * Whether the user can access a given enterprise.
 * Pass `infraToLocation` (Map<infrastructureId, farmLocationId>) to enable
 * location-based checks for the `manager` role; without it, manager with
 * assigned locations falls back to checking `assignedInfrastructureIds`.
 */
export function canAccessEnterprise(
  user: AppUser,
  enterprise: EnterpriseInstance,
  infraToLocation?: Map<string, string>,
): boolean {
  if (hasPermission(user, 'all_locations')) return true

  if (hasPermission(user, 'assigned_locations_only')) {
    // Manager with no explicit assignments → full access
    if (
      user.assignedFarmLocationIds.length === 0 &&
      user.assignedInfrastructureIds.length === 0
    ) return true

    // Use location map when provided
    if (infraToLocation) {
      const locId = infraToLocation.get(enterprise.infrastructureId)
      return locId ? user.assignedFarmLocationIds.includes(locId) : false
    }

    // Fallback: use infrastructure-level assignment
    if (user.assignedInfrastructureIds.length > 0) {
      return user.assignedInfrastructureIds.includes(enterprise.infrastructureId)
    }

    return true
  }

  if (hasPermission(user, 'assigned_infrastructure_only')) {
    return user.assignedInfrastructureIds.includes(enterprise.infrastructureId)
  }

  return false
}

export function canAccessLocation(user: AppUser, locationId: string): boolean {
  if (hasPermission(user, 'all_locations')) return true
  if (hasPermission(user, 'assigned_locations_only')) {
    if (user.assignedFarmLocationIds.length === 0) return true
    return user.assignedFarmLocationIds.includes(locationId)
  }
  return false
}

export function getVisibleEnterprises(
  user: AppUser,
  allEnterprises: EnterpriseInstance[],
  infraToLocation?: Map<string, string>,
): EnterpriseInstance[] {
  if (hasPermission(user, 'all_locations')) return allEnterprises
  return allEnterprises.filter(e => canAccessEnterprise(user, e, infraToLocation))
}
