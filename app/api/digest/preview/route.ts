import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { digestEmail } from '@/lib/emails/digest-template'
import { fetchDigestPool, selectForMember, type DigestFrequency, type DigestPreferences } from '@/lib/emails/digest'
import { manageUrl, unsubscribeUrl } from '@/lib/emails/digest-runner'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'

const VALID_FREQUENCIES: DigestFrequency[] = ['weekly', 'fortnightly', 'monthly']

/**
 * GET /api/digest/preview?frequency=weekly
 *
 * Renders what the next digest would look like against live content, for the
 * admin panel. Admin-only (it exposes unpublished-adjacent scheduling detail
 * and the exact send composition), and writes nothing.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin', 'editor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requested = request.nextUrl.searchParams.get('frequency') as DigestFrequency | null
  const frequency: DigestFrequency = requested && VALID_FREQUENCIES.includes(requested) ? requested : 'weekly'

  try {
    const now = new Date()
    const pool = await fetchDigestPool(supabase, now)

    // A never-yet-sent subscriber on this cadence: the widest window anyone on
    // this frequency could see, which is the useful worst case to eyeball.
    const prefs: DigestPreferences = {
      user_id: user.id,
      frequency,
      include_events: true,
      include_news: true,
      news_categories: [],
      unsubscribe_token: 'preview-token',
      last_sent_at: null,
    }

    const selection = selectForMember(pool, prefs, now)
    const email = digestEmail({
      name: profile.full_name || 'there',
      frequency,
      events: selection.events,
      posts: selection.posts,
      siteUrl: SITE_URL,
      manageUrl: manageUrl(prefs.unsubscribe_token),
      unsubscribeUrl: unsubscribeUrl(prefs.unsubscribe_token),
      issueDate: now,
    })

    return NextResponse.json({
      subject: email.subject,
      html: email.html,
      text: email.text,
      eventCount: selection.events.length,
      postCount: selection.posts.length,
      isEmpty: selection.isEmpty,
      windowStart: selection.windowStart.toISOString(),
    })
  } catch (error: any) {
    console.error('[digest] preview failed:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
