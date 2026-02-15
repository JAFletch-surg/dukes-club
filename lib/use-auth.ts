'use client'

import { useEffect, useState } from 'react'
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

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function getSession() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        setUser(user)
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
          if (!cancelled) setProfile(data)
        }
      } catch (e) {
        // Ignore AbortError
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          try {
            const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
            if (!cancelled) setProfile(data)
          } catch (e) {}
        } else {
          setProfile(null)
        }
        if (!cancelled) setLoading(false)
      }
    )

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
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

  return { user, profile, loading, signOut, isAdmin, isEditor, isMember, isTrainee, isPending }
}