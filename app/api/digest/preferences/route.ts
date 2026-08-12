import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NEWS_CATEGORIES } from '@/lib/constants/news-categories'
import { FREQUENCY_DAYS } from '@/lib/emails/digest'

export const dynamic = 'force-dynamic'

// Token-scoped preference centre for the link in every digest footer. A member
// who has lost access to their login (or simply can't be bothered to sign in)
// must still be able to change their cadence or opt out — burying that behind
// authentication is what turns unsubscribes into spam reports.
//
// The token is an unguessable UUID that grants exactly one capability: reading
// and writing this one row. It never authenticates the session, and the route
// deliberately returns nothing about the member beyond their own email.

const VALID_FREQUENCIES = [...Object.keys(FREQUENCY_DAYS), 'never']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/digest/preferences?token=... — current settings for that token. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || !UUID_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('digest_preferences')
    .select('user_id, frequency, include_events, include_news, include_videos, news_categories')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    console.error('[digest] preference lookup failed:', error.message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', data.user_id)
    .maybeSingle()

  return NextResponse.json({
    frequency: data.frequency,
    includeEvents: data.include_events,
    includeNews: data.include_news,
    includeVideos: data.include_videos,
    newsCategories: data.news_categories || [],
    email: profile?.email || null,
    name: profile?.full_name || null,
  })
}

/** POST /api/digest/preferences — update the settings behind a token. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { token, frequency, includeEvents, includeNews, includeVideos, newsCategories } = body as {
    token?: string
    frequency?: string
    includeEvents?: boolean
    includeNews?: boolean
    includeVideos?: boolean
    newsCategories?: string[]
  }

  if (!token || !UUID_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: 'Unknown frequency' }, { status: 400 })
    }
    update.frequency = frequency
  }

  if (includeEvents !== undefined) update.include_events = !!includeEvents
  if (includeNews !== undefined) update.include_news = !!includeNews
  if (includeVideos !== undefined) update.include_videos = !!includeVideos

  if (newsCategories !== undefined) {
    if (!Array.isArray(newsCategories)) {
      return NextResponse.json({ error: 'newsCategories must be an array' }, { status: 400 })
    }
    // Unknown values are dropped rather than rejected: a category retired from
    // the site shouldn't make a member's saved preferences unsavable.
    update.news_categories = newsCategories.filter((c) => (NEWS_CATEGORIES as readonly string[]).includes(c))
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('digest_preferences')
    .update(update)
    .eq('unsubscribe_token', token)
    .select('frequency, include_events, include_news, include_videos, news_categories')
    .maybeSingle()

  if (error) {
    console.error('[digest] preference update failed:', error.message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    frequency: data.frequency,
    includeEvents: data.include_events,
    includeNews: data.include_news,
    includeVideos: data.include_videos,
    newsCategories: data.news_categories || [],
  })
}
