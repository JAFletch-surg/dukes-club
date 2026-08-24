import { redirect } from 'next/navigation'
import { AuthProvider } from '@/lib/auth-provider'
import { getAuthUser, getProfile, isAdminRole } from '@/lib/supabase/auth'
import AdminLayoutClient from './admin-layout-client'

/**
 * Server shell for the admin panel.
 *
 * Same contract as app/members/layout.tsx: one locally-verified claims read
 * plus one profile query per request, and the redirects are navigation rather
 * than the authorization boundary — RLS (the is_admin() SQL helper) and
 * requireAdmin() in the API routes are what enforce admin access.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)

  // Fail closed on a missing row, a failed query, or an unrecognised role.
  if (!profile) redirect('/login')
  if (!isAdminRole(profile.role)) redirect('/members')
  if (profile.approval_status !== 'approved') redirect('/members')

  return (
    <AuthProvider initialUser={user} initialProfile={profile}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AuthProvider>
  )
}
