import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runDigest, sendTestDigest } from '@/lib/emails/digest-runner'

// The run walks every subscriber, so give it room beyond the default 10s.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Authorise the caller: either the shared internal secret (scripts, webhooks)
 * or a signed-in admin. Mirrors /api/email/send.
 */
async function authorise(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const internalSecret = request.headers.get('x-internal-secret')
  if (internalSecret && process.env.INTERNAL_API_SECRET && internalSecret === process.env.INTERNAL_API_SECRET) {
    return null
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return 'Unauthorized'

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return 'Unauthorized'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin', 'editor'].includes(profile.role)) return 'Forbidden'
  return null
}

/**
 * POST /api/digest/send — run the digest on demand.
 *
 * Body (all optional):
 *   force      — ignore each member's cadence and send to every subscriber
 *   dryRun     — report who would receive what, send nothing, write nothing
 *   testEmail  — send one sample digest to this address only, write nothing
 *   userIds    — restrict the run to these members
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabase()

  try {
    const denied = await authorise(request, supabase)
    if (denied) {
      return NextResponse.json({ error: denied }, { status: denied === 'Forbidden' ? 403 : 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { force, dryRun, testEmail, userIds } = body as {
      force?: boolean
      dryRun?: boolean
      testEmail?: string
      userIds?: string[]
    }

    if (testEmail) {
      const result = await sendTestDigest(supabase, testEmail)
      return NextResponse.json({ success: true, test: true, ...result })
    }

    const result = await runDigest(supabase, { force, dryRun, userIds })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[digest] run failed:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
