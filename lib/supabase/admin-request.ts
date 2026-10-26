import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type AdminRequestAuth =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Bearer token → Supabase user → admin / super_admin role check, for API
 * routes called from the admin UI with the member's access token. Returns a
 * service-role client on success so the route can reach the Auth admin API.
 */
export async function requireAdminRequest(request: NextRequest): Promise<AdminRequestAuth> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const token = authHeader.slice('Bearer '.length)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 }) }
  }

  return { ok: true, supabase, userId: user.id }
}
