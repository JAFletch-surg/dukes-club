'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function init() {
      try {
        // getSession reads from local storage — instant, no network call
        const { data: { session } } = await supabase.auth.getSession()
        
        if (cancelled) return

        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
          if (!cancelled) setLoading(false)
          
          // Verify with getUser in background (network call)
          const { data: { user: verifiedUser } } = await supabase.auth.getUser()
          if (cancelled) return
          if (verifiedUser) {
            setUser(verifiedUser)
          } else {
            setUser(null)
            setProfile(null)
          }
        } else {
          // No cached session — try getUser as fallback
          const { data: { user: freshUser } } = await supabase.auth.getUser()
          if (cancelled) return
          if (freshUser) {
            setUser(freshUser)
            await fetchProfile(freshUser.id)
          } else {
            setUser(null)
            setProfile(null)
          }
          if (!cancelled) setLoading(false)
        }
      } catch (e) {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await fetchProfile(u.id)
        } else {
          setProfile(null)
        }
        if (!cancelled) setLoading(false)
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    window.location.href = '/'
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  const isEditor = profile?.role === 'editor' || isAdmin
  const isMember = profile?.role === 'member' || isEditor
  const isTrainee = profile?.role === 'trainee' || isMember
  const isPending = profile?.approval_status === 'pending'

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signOut,
      isAdmin, isEditor, isMember, isTrainee, isPending,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}