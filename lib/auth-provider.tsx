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
  // onAuthStateChange fires INITIAL_SESSION synchronously when the
  // listener is registered, giving us the stored session. It then
  // fires SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT as they happen.
  // This is the recommended Supabase pattern — no separate
  // getUser() / getSession() call that can race with the listener.

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        // INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
        await resolveAuth(session?.user ?? null)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, resolveAuth])

  // ── Visibility change: manage auto-refresh lifecycle ────────────
  //
  // When the tab is hidden, the browser throttles timers so
  // Supabase's auto-refresh may not fire. Using the official
  // startAutoRefresh / stopAutoRefresh API ensures the refresh
  // timer restarts immediately when the tab regains focus and
  // triggers a token refresh if the access token has expired.

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
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
