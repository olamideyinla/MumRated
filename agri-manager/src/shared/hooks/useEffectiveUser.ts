import { useAuthStore } from '../../stores/auth-store'
import type { AppUser } from '../types'

/**
 * Returns the "effective" app user for UI rendering.
 * When the owner activates "View As", this returns the viewed member instead
 * of the owner, so the UI (nav, role checks, data filters) reflects that member.
 *
 * All writes still use the real `appUser` — only reads/display use this hook.
 */
export function useEffectiveAppUser(): AppUser | null {
  return useAuthStore(s => s.viewingAs ?? s.appUser)
}
