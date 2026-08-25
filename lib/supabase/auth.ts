import { cache } from 'react'
import { createServerSupabaseClient } from './server'
import type { Profile } from '@/lib/auth-provider'

/**
 * Server-side auth for the protected route groups.
 *
 * Deliberately claims-based rather than getUser(): every consumer of useAuth()
 * reads exactly two fields off the auth user — user.id and user.email — and
 * both are in the access token. getUser() would post to the Supabase Auth
 * service on every request to fetch a record we then throw away.
 *
 * getClaims() verifies the JWT locally against a cached JWKS when the project
 * uses asymmetric signing keys. On a project still using the legacy symmetric
 * secret it falls back to an Auth network call — correct either way, just not
 * as cheap. Check with:
 *   curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/.well-known/jwks.json"
 * An empty `keys` array means symmetric; migrating to asymmetric keys is what
 * makes this local.
 *
 * Both helpers are wrapped in React cache() so a layout and any nested server
 * component in the same request share one call. That does NOT extend to
 * middleware — middleware runs in a separate execution context and cannot
 * share anything with the render pass.
 */

/** The subset of the auth user the client actually reads. */
export interface AuthUser {
  id: string
  email?: string | null
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) return null

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === 'string' ? data.claims.email : null,
  }
})

/** Every column the Profile interface declares — never select('*'). */
const PROFILE_COLUMNS =
  'id, full_name, email, role, approval_status, region, member_category, country, training_stage, avatar_url, acpgbi_number, gmc_number, created_at'

/**
 * Fails closed: a query error and a missing row are both null, and every
 * caller treats null as "not allowed through".
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[auth] profile lookup failed:', error.message)
    return null
  }

  return (data as Profile | null) ?? null
})

export const ADMIN_ROLES = ['admin', 'super_admin', 'editor'] as const

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}
