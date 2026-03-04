'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

const supabase = createClient()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        setUser(user)
        if (user) {
          await fetchProfile(user.id)
        }
      } catch (e) {
        // Ignore AbortError from lock contention in dev
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
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
  }, [])

  const signOut = async () => {
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
