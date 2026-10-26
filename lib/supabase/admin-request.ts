import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type AdminRequestAuth =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: NextResponse }

const DEFAULT_ROLES = ['admin', 'super_admin']

/**
 * Bearer token → Supabase user → role check, for API routes called from the
 * admin UI with the member's access token. Allows admin and super_admin by
 * default; pass `roles` to narrow it (e.g. ['super_admin']). Returns a
 * service-role client on success so the route can reach the Auth admin API.
 */
export async function requireAdminRequest(
  request: NextRequest,
  roles: readonly string[] = DEFAULT_ROLES
): Promise<AdminRequestAuth> {
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

  if (!profile || !roles.includes(profile.role)) {
    const who = roles.length === 1 && roles[0] === 'super_admin' ? 'super admin' : 'admin'
    return { ok: false, response: NextResponse.json({ error: `Forbidden — ${who} only` }, { status: 403 }) }
  }

  return { ok: true, supabase, userId: user.id }
}
