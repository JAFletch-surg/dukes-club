import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDigest } from '@/lib/emails/digest-runner'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * GET /api/digest/cron — the scheduled entry point, wired up in vercel.json.
 *
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Every
 * member whose cadence is up gets a digest; the rest are left alone, so it is
 * safe (and intended) to run this weekly regardless of who is due.
 *
 * The schedule sets the *fastest possible* cadence — a weekly cron means
 * fortnightly subscribers are simply skipped on alternate runs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  const authHeader = request.headers.get('authorization')

  if (!secret) {
    console.error('[digest] cron called but neither CRON_SECRET nor INTERNAL_API_SECRET is set')
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const result = await runDigest(supabase)
    console.log('[digest] scheduled run complete:', result)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[digest] scheduled run failed:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
