import { redirect } from 'next/navigation'
import { Cormorant_Garamond } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-provider'
import { getAuthUser, getProfile } from '@/lib/supabase/auth'
import MembersLayoutClient from './members-layout-client'

/** Used by the feedback page's headings; see app/admin/layout.tsx. */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
})

/**
 * Server shell for the members portal — mirrors app/admin/layout.tsx.
 *
 * Resolves auth once per request (locally-verified claims + one profile
 * query) and seeds the provider, so the sidebar and profile name are there on
 * first paint without the client re-fetching what the server already knows.
 *
 * The redirects below are navigation, NOT the authorization boundary: Next.js
 * does not guarantee a layout re-renders on client-side navigation. Every
 * members page reads Supabase directly under RLS (supabase/rls-policies.sql)
 * and every privileged API route re-authenticates its own caller — that is
 * what actually keeps data in. These checks fail closed anyway.
 */
export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)

  // No row, or the query failed — never render the portal on an unknown state.
  if (!profile) redirect('/login')

  if (profile.approval_status === 'pending') redirect('/pending-approval')
  if (profile.approval_status !== 'approved') redirect('/login')

  return (
    <AuthProvider initialUser={user} initialProfile={profile}>
      <div className={cormorant.variable}>
        <MembersLayoutClient>{children}</MembersLayoutClient>
      </div>
    </AuthProvider>
  )
}
