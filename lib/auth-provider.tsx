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

  // Single Supabase client for the lifetime of this provider.
  // useRef keeps it stable across re-renders without retriggering effects.
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

  // ── Public refresh (e.g. after user edits their own profile) ─────

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const freshProfile = await fetchProfile(user.id)
    if (freshProfile) setProfile(freshProfile)
  }, [user, fetchProfile])

  // ── Single effect: onAuthStateChange as the sole source of truth ─
  //
  // Supabase v2 fires INITIAL_SESSION synchronously on subscribe,
  // so we don't need a separate getSession() / getUser() init flow.
  // This eliminates the race condition between init() and the
  // auth listener that caused flickering and stale state.

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id)
          if (!mounted) return
          setProfile(profileData)
        } else {
          setProfile(null)
        }

        // Loading → false ONCE, after we've resolved both user + profile
        if (mounted) setLoading(false)
      }
    )

    // Safety net: if onAuthStateChange never fires (edge case),
    // clear loading after 5 seconds so the UI isn't stuck
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Timed out waiting for auth state — clearing loading')
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps — runs once on mount; supabase is stable via ref

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