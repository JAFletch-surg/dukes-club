'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────

export interface Profile {
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
//
// Accepts an optional initialUser from the server (via getUser() in a
// Server Component like the root layout). This eliminates the loading
// flash on first render — the client hydrates with the server-validated
// user immediately, then onAuthStateChange keeps it in sync.
//
// See: https://supabase.com/docs/guides/auth/server-side/nextjs

interface AuthProviderProps {
  initialUser?: User | null
  initialProfile?: Profile | null
  children: React.ReactNode
}

export function AuthProvider({ initialUser = null, initialProfile = null, children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [loading, setLoading] = useState(!initialUser)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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

  // ── Resolve auth state ────────────────────────────────────────────

  const resolveAuth = useCallback(
    async (currentUser: User | null) => {
      setUser(currentUser)

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }

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

  // ── Auth state: single source of truth via onAuthStateChange ─────
  //
  // IMPORTANT: The callback must NOT be async — Supabase warns that
  // async callbacks can interfere with token refresh. Instead we
  // schedule resolveAuth via setTimeout so it runs outside the
  // auth state change handler.

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return

        console.log('[Auth] onAuthStateChange:', event, 'session:', !!session)

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        // Schedule outside the callback to avoid blocking token refresh
        setTimeout(() => {
          if (mounted) resolveAuth(session?.user ?? null)
        }, 0)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, resolveAuth])

  // ── Recover session when tab becomes visible again ─────────────
  //
  // Browsers throttle timers in background tabs, so the Supabase
  // auto-refresh can miss its window. When the user returns to the
  // tab, we manually check and refresh the session.

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Auth] Tab visible — refreshing session')
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setUser(session.user)
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [supabase])

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
