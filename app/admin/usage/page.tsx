import { redirect } from 'next/navigation'
import { getAuthUser, getProfile } from '@/lib/supabase/auth'
import UsageDashboard from './usage-dashboard'

/**
 * Site Usage — super admin only.
 *
 * The admin layout has already confirmed an approved admin-tier role; this
 * narrows it. The API route behind the page enforces the same check, so this
 * redirect is navigation, not the security boundary.
 */
export default async function UsagePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (profile?.role !== 'super_admin') redirect('/admin')

  return <UsageDashboard />
}
