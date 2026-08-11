import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// The target of the List-Unsubscribe header. Gmail and Outlook POST here when
// a member uses the mail client's own unsubscribe control (RFC 8058), and some
// older clients follow it as a plain link — both are handled.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'

async function unsubscribe(token: string): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('digest_preferences')
    .update({ frequency: 'never' })
    .eq('unsubscribe_token', token)
    .select('user_id')
    .maybeSingle()

  if (error) {
    console.error('[digest] one-click unsubscribe failed:', error.message)
    return false
  }
  return !!data
}

/** One-click unsubscribe from the mail client's own control. */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || !UUID_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const ok = await unsubscribe(token)
  if (!ok) return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })

  return NextResponse.json({ success: true })
}

/**
 * Followed as a link by clients that ignore List-Unsubscribe-Post. Hand the
 * member to the preference centre, which opts them out and then offers a less
 * frequent cadence as an alternative to leaving entirely.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  return NextResponse.redirect(
    `${SITE_URL}/email-preferences?token=${encodeURIComponent(token)}&unsubscribe=1`
  )
}
