import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../core/config/supabase'
import { db } from '../core/database/db'
import { seedInitialData } from '../core/database/seed'
import { cancelDebouncedPush } from '../core/sync/sync-triggers'
import { nowIso } from '../shared/types/base'
import type { AppUser, UserRole } from '../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignUpParams {
  email?: string
  phone: string
  password: string
  fullName: string
  farmName: string
  currency?: string
}

interface AuthState {
  user: User | null
  appUser: AppUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  hasInitialized: boolean
  error: string | null
  /** Non-null when the owner is previewing another team member's perspective. */
  viewingAs: AppUser | null

  initialize: () => Promise<void>
  signUp: (params: SignUpParams) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithPhone: (phone: string) => Promise<void>
  verifyOtp: (phone: string, otp: string) => Promise<void>
  /** Redeem an invite: authenticates with phone+code, validates invite, seeds local DB. */
  acceptInvite: (phone: string, inviteCode: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Pick<AppUser, 'fullName' | 'phone' | 'email'>>) => Promise<void>
  clearError: () => void
  setViewingAs: (member: AppUser | null) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapError(msg: string): string {
  if (/invalid.*(login|credentials)|invalid_grant/i.test(msg))
    return 'Incorrect email or password'
  if (/not confirmed/i.test(msg))
    return 'Please confirm your email address first'
  if (/already registered|already exists/i.test(msg))
    return 'An account already exists with this contact. Try signing in instead.'
  if (/password.*(at least|too short)|weak password/i.test(msg))
    return 'Password must be at least 6 characters'
  if (/otp.*invalid|token.*invalid|token.*expired/i.test(msg))
    return 'Invalid or expired code. Please request a new one.'
  if (/rate.?limit|too many/i.test(msg))
    return 'Too many attempts. Please wait a few minutes and try again.'
  if (/network|fetch failed|connection refused/i.test(msg))
    return 'Connection error. Please check your internet and try again.'
  return msg
}

async function loadAppUser(userId: string): Promise<AppUser | null> {
  try {
    return (await db.appUsers.get(userId)) ?? null
  } catch (e) {
    console.warn('[loadAppUser] IndexedDB error for userId:', userId, e)
    return null
  }
}

/** Normalise to last 9 digits for loose phone matching (handles +254 vs 0254 etc.) */
function normalizePhone(p: string): string {
  return p.replace(/\D/g, '').slice(-9)
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  appUser: null,
  session: null,
  isLoading: true, // true until initialize() finishes
  isAuthenticated: false,
  hasInitialized: false,
  error: null,
  viewingAs: null,

  initialize: async () => {
    if (get().hasInitialized) return
    set({ hasInitialized: true })

    try {
      // getSession() reads from localStorage — works offline
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        let appUser = await loadAppUser(session.user.id)
        const isWorkerAccount = session.user.email?.endsWith('@agrimanager.app') ?? false
        if (!appUser && !isWorkerAccount) {
          try {
            await seedInitialData({
              userId: session.user.id,
              email: session.user.email ?? '',
              fullName: session.user.user_metadata?.full_name ?? '',
              orgName: 'My Farm',
            })
          } catch { /* records may already exist */ }
          appUser = await loadAppUser(session.user.id)
        }
        set({ session, user: session.user, appUser, isAuthenticated: !!appUser, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }

    // Watch for external changes: token refresh, sign-out from another tab
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ session: null, user: null, appUser: null, isAuthenticated: false })
      } else if (event === 'TOKEN_REFRESHED' && session) {
        set({ session })
      } else if (event === 'USER_UPDATED' && session?.user) {
        const appUser = await loadAppUser(session.user.id)
        set({ session, user: session.user, appUser })
      }
    })
  },

  signUp: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const credentials = params.email
        ? { email: params.email, password: params.password }
        : { phone: params.phone, password: params.password }

      const { data, error } = await supabase.auth.signUp({
        ...credentials,
        options: { data: { full_name: params.fullName, phone: params.phone } },
      })

      if (error) { set({ error: mapError(error.message), isLoading: false }); return }
      if (!data.user) { set({ error: 'Sign up failed. Please try again.', isLoading: false }); return }

      await seedInitialData({
        userId: data.user.id,
        email: params.email ?? '',
        fullName: params.fullName,
        orgName: params.farmName,
        currency: params.currency,
      })

      const appUser = await loadAppUser(data.user.id)

      if (data.session) {
        set({ session: data.session, user: data.user, appUser, isAuthenticated: true, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch (e: any) {
      set({ error: mapError(e?.message ?? 'Sign up failed'), isLoading: false })
    }
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { set({ error: mapError(error.message), isLoading: false }); return }
      let appUser = await loadAppUser(data.user.id)
      const isWorkerAccount = (data.user.email ?? email).endsWith('@agrimanager.app')
      if (!appUser && !isWorkerAccount) {
        try {
          await seedInitialData({
            userId: data.user.id,
            email: data.user.email ?? email,
            fullName: data.user.user_metadata?.full_name ?? '',
            orgName: 'My Farm',
          })
        } catch { /* records may already exist */ }
        appUser = await loadAppUser(data.user.id)
      }
      set({ session: data.session, user: data.user, appUser, isAuthenticated: !!appUser, isLoading: false })
    } catch (e: any) {
      set({ error: mapError(e?.message ?? 'Sign in failed'), isLoading: false })
    }
  },

  signInWithPhone: async (phone) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) { set({ error: mapError(error.message), isLoading: false }); return }
      set({ isLoading: false })
    } catch (e: any) {
      set({ error: mapError(e?.message ?? 'Failed to send code'), isLoading: false })
    }
  },

  verifyOtp: async (phone, otp) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
      if (error) { set({ error: mapError(error.message), isLoading: false }); return }
      if (!data.user || !data.session) {
        set({ error: 'Verification failed. Please try again.', isLoading: false }); return
      }

      let appUser = await loadAppUser(data.user.id)
      if (!appUser) {
        await seedInitialData({
          userId: data.user.id,
          email: data.user.email ?? '',
          fullName: data.user.user_metadata?.full_name ?? 'Farm User',
          orgName: 'My Farm',
        })
        appUser = await loadAppUser(data.user.id)
      }

      set({ session: data.session, user: data.user, appUser, isAuthenticated: true, isLoading: false })
    } catch (e: any) {
      set({ error: mapError(e?.message ?? 'Verification failed'), isLoading: false })
    }
  },

  acceptInvite: async (phone, inviteCode) => {
    set({ isLoading: true, error: null })
    try {
      const normPhone = phone.startsWith('+') ? phone : `+${phone}`
      const code = inviteCode.toUpperCase().trim()

      // Derive a deterministic email from the phone number so we can use
      // email+password auth (phone auth provider is not required).
      const digits = normPhone.replace(/\D/g, '')
      const workerEmail = `${digits}@agrimanager.app`

      // Try sign-in first (returning worker), then sign-up for new workers.
      let session: Session | null = null
      let userId = ''

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: workerEmail,
        password: code,
      })

      if (!signInErr && signInData.session) {
        session = signInData.session
        userId  = signInData.user.id

        // ── Returning worker: already set up on this device ──────────────────
        const existingUser = await loadAppUser(userId)
        if (existingUser) {
          set({ session, user: session.user, appUser: existingUser, isAuthenticated: true, isLoading: false })
          return
        }
        // Sign-in succeeded but no local data (re-install / new device) →
        // fall through to re-seed from the invite record below.
      } else {
        // ── New worker: create Supabase Auth account ──────────────────────────
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: workerEmail,
          password: code,
        })
        if (signUpErr || !signUpData.user) {
          set({ error: mapError(signUpErr?.message ?? 'Could not create account'), isLoading: false }); return
        }
        if (!signUpData.session) {
          // Supabase has email confirmation enabled — must be disabled for this flow
          set({ error: 'Account setup requires email confirmation to be disabled. Please ask your farm owner to check Supabase Authentication settings.', isLoading: false }); return
        }
        session = signUpData.session
        userId  = signUpData.user.id
      }

      // ── Validate invite code ────────────────────────────────────────────────
      // Allow unredeemed codes (new workers) OR codes redeemed by this user (re-install).
      const { data: invite, error: fetchErr } = await supabase
        .from('team_invites')
        .select('*')
        .eq('invite_code', code)
        .or(`redeemed_at.is.null,redeemed_by.eq.${userId}`)
        .single()

      if (fetchErr || !invite) {
        set({ error: 'Invalid or already used invite code.', isLoading: false }); return
      }

      // Verify phone matches the invited member
      if (normalizePhone(invite.phone as string) !== normalizePhone(normPhone)) {
        set({ error: 'This invite code does not match your phone number.', isLoading: false }); return
      }

      const ts = nowIso()

      await db.transaction('rw', [db.organizations, db.appUsers], async () => {
        try {
          await db.organizations.add({
            id:                 invite.organization_id as string,
            name:               invite.org_name as string,
            currency:           (invite.org_currency as string) || 'USD',
            defaultUnitSystem:  'metric',
            syncStatus:         'pending',
            createdAt:          ts,
            updatedAt:          ts,
          })
        } catch { /* org may already exist on this device */ }

        await db.appUsers.put({
          id:                          userId,
          organizationId:              invite.organization_id as string,
          fullName:                    invite.full_name as string,
          phone:                       invite.phone as string,
          email:                       (invite.email as string) || undefined,
          role:                        invite.role as UserRole,
          assignedFarmLocationIds:     (invite.assigned_farm_location_ids as string[]) || [],
          assignedInfrastructureIds:   (invite.assigned_infrastructure_ids as string[]) || [],
          isActive:                    true,
          syncStatus:                  'pending',
          createdAt:                   ts,
          updatedAt:                   ts,
        })
      })

      // Mark invite as redeemed (idempotent — skip if already done)
      if (!invite.redeemed_at) {
        await supabase
          .from('team_invites')
          .update({ redeemed_at: ts, redeemed_by: userId })
          .eq('invite_code', code)
      }

      const appUser = await loadAppUser(userId)
      set({ session, user: session!.user, appUser, isAuthenticated: true, isLoading: false })
    } catch (e: any) {
      set({ error: mapError(e?.message ?? 'Failed to redeem invite'), isLoading: false })
    }
  },

  signOut: async () => {
    cancelDebouncedPush()
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    set({ session: null, user: null, appUser: null, isAuthenticated: false, error: null })
  },

  updateProfile: async (updates) => {
    const { appUser } = get()
    if (!appUser) return
    set({ error: null })
    try {
      const updated: AppUser = { ...appUser, ...updates, updatedAt: nowIso(), syncStatus: 'pending' }
      await db.appUsers.put(updated)
      set({ appUser: updated })
      await supabase.auth.updateUser({
        data: { full_name: updated.fullName, phone: updated.phone },
      })
    } catch (e: any) {
      set({ error: mapError(e?.message ?? 'Profile update failed') })
    }
  },

  clearError: () => set({ error: null }),

  setViewingAs: (member) => set({ viewingAs: member }),
}))
