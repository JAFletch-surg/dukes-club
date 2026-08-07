import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Supabase (service role for admin-level DB access) ───────────

export function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Vimeo ───────────────────────────────────────────────────────

export const VIMEO_TOKEN = process.env.VIMEO_ACCESS_TOKEN
export const VIMEO_API = 'https://api.vimeo.com'

export const VIMEO_HEADERS = {
  Authorization: `bearer ${VIMEO_TOKEN}`,
  Accept: 'application/vnd.vimeo.*+json;version=3.4',
}

/**
 * Pull the trailing ID out of a Vimeo resource URI.
 *   /videos/123456        → 123456
 *   /videos/123456:hash   → 123456
 *   /users/1/projects/456 → 456
 */
export function extractIdFromUri(uri: string): string {
  const last = uri.split('/').pop() || ''
  return last.split(':')[0]
}

// ── Auth ────────────────────────────────────────────────────────

export type AdminAuth =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Bearer token → Supabase user → admin role check.
 * Shared by the sync and folders routes so the guard only lives in one place.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuth> {
  const supabase = getSupabase()

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 }),
    }
  }

  return { ok: true, supabase, userId: user.id }
}
