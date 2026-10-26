import type { SupabaseClient } from '@supabase/supabase-js'

// listUsers() is paginated — the default page size only covers the first
// handful of members, so it must never be called without paging through
// every page (see findUserByEmail below).
const USERS_PER_PAGE = 1000
const MAX_USER_PAGES = 50

export type FoundUser = { id: string; fullName: string | null }

/** Escape LIKE/ILIKE wildcards so an address containing `_` or `%` matches literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Resolve an email address to a user. Needs a service-role client.
 *
 * Prefers a direct, case-insensitive lookup against `profiles` (one indexed
 * query, no pagination). Falls back to paging through auth.users for accounts
 * that have no profile row yet, or whose auth email differs from their profile
 * email.
 */
export async function findUserByEmail(
  supabase: SupabaseClient,
  normalizedEmail: string
): Promise<FoundUser | null> {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('email', escapeLikePattern(normalizedEmail))
    .limit(1)

  if (profileError) {
    console.error('Error looking up profile by email:', profileError)
  } else if (profiles && profiles.length > 0) {
    return { id: profiles[0].id, fullName: profiles[0].full_name ?? null }
  }

  // Fallback: page through auth.users rather than relying on the first page.
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    })

    if (error) {
      console.error('Error listing users:', error)
      return null
    }

    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === normalizedEmail)

    if (match) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', match.id)
        .maybeSingle()

      return { id: match.id, fullName: profile?.full_name ?? null }
    }

    if (users.length < USERS_PER_PAGE) break
  }

  return null
}
