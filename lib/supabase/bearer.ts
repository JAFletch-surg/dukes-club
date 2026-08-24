import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Request-scoped Supabase client authenticated as the caller.
 *
 * The anon key plus the caller's access token, so RLS still applies as that
 * user — this is NOT the service-role client in app/api/webinars/_shared.ts,
 * which bypasses RLS on purpose and must not be used for member-owned rows.
 *
 * Returns null when the Authorization header is missing or the token does not
 * resolve to a user.
 */
export async function bearerClient(
  request: NextRequest
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length)
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  return { supabase, userId: user.id }
}
