'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  approval_status: string
  region: string | null
  training_stage: string | null
  avatar_url: string | null
  acpgbi_number: string | null
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  isAdmin: boolean
  isEditor: boolean
  isMember: boolean
  isTrainee: boolean
  isPending: boolean
  refreshProfile: () => Promise<void>
}

// ─── Context ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  isEditor: false,
  isMember: false,
  isTrainee: false,
  isPending: false,
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// ─── Provider ────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Track whether we've resolved auth at least once
  const resolvedRef = useRef(false)

  // ── Fetch profile ────────────────────────────────────────────────

  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('[Auth] Profile fetch failed:', error.message)
          return null
        }
        return data as Profile
      } catch (err) {
        console.error('[Auth] Profile fetch exception:', err)
        return null
      }
    },
    [supabase]
  )

  // ── Resolve auth state (shared by init and listener) ─────────────

  const resolveAuth = useCallback(
    async (currentUser: User | null) => {
      setUser(currentUser)

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }

      resolvedRef.current = true
      setLoading(false)
    },
    [fetchProfile]
  )

  // ── Public refresh (e.g. after user edits their own profile) ─────

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const freshProfile = await fetchProfile(user.id)
    if (freshProfile) setProfile(freshProfile)
  }, [user, fetchProfile])

  // ── Initialise: getUser() for server-validated auth ──────────────
  //
  // We use getUser() instead of getSession() because getUser()
  // contacts the Supabase Auth server and validates the token.
  // getSession() only reads from local storage and can return
  // expired/revoked tokens, leading to a "stale session" where
  // the UI thinks it's authenticated but data fetches fail.
  //
  // onAuthStateChange handles subsequent events: sign in,
  // sign out, token refresh.

  useEffect(() => {
    let mounted = true

    // 1. Server-validated init via getUser()
    const init = async () => {
      try {
        const { data: { user: validatedUser }, error } = await supabase.auth.getUser()
        if (mounted && !resolvedRef.current) {
          if (error || !validatedUser) {
            await resolveAuth(null)
          } else {
            await resolveAuth(validatedUser)
          }
        }
      } catch (err) {
        console.error('[Auth] Init failed:', err)
        if (mounted) setLoading(false)
      }
    }

    init()

    // 2. Listen for subsequent auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return
        // Skip INITIAL_SESSION if we already resolved via getUser
        if (event === 'INITIAL_SESSION' && resolvedRef.current) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          return
        }

        await resolveAuth(session?.user ?? null)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, resolveAuth])

  // ── Visibility change: re-validate session when tab regains focus ─
  //
  // When a user switches tabs, locks their device, or the browser
  // throttles the background tab, the Supabase auto-refresh timer
  // may not fire. When the user returns, the access token could be
  // expired. This listener proactively re-validates on focus return.

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return

      // Re-validate with the server — this also triggers a token
      // refresh if the access token is expired but the refresh
      // token is still valid
      const { data: { user: freshUser }, error } = await supabase.auth.getUser()

      if (error || !freshUser) {
        // Session is truly dead — clear client state
        setUser(null)
        setProfile(null)
      } else if (freshUser.id !== user?.id) {
        // User changed (rare) or was null and is now valid
        await resolveAuth(freshUser)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [supabase, user?.id, resolveAuth])

  // ── Sign out ─────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    window.location.href = '/'
  }, [supabase])

  // ── Role derivations ─────────────────────────────────────────────

  const role = profile?.role
  const isAdmin = role === 'admin' || role === 'super_admin'
  const isEditor = role === 'editor' || isAdmin
  const isMember = role === 'member' || isEditor
  const isTrainee = role === 'trainee' || isMember
  const isPending = profile?.approval_status === 'pending'

  // ── Render ───────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        isAdmin,
        isEditor,
        isMember,
        isTrainee,
        isPending,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
