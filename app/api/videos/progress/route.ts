import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── POST — save / update watch progress ─────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated — please log in again' },
        { status: 401 }
      )
    }

    const body: {
      video_id: string
      watched_seconds: number
      duration_seconds: number
      completed: boolean
    } = await request.json()

    if (!body.video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 })
    }

    const watchedSeconds = Math.floor(body.watched_seconds || 0)
    const durationSeconds = Math.floor(body.duration_seconds || 0)
    const completed = body.completed || false
    const now = new Date().toISOString()

    // If this is a progress update (not a completion), check if the video
    // was already completed so we don't regress the completed status
    if (!completed) {
      const { data: existing } = await supabase
        .from('video_watch_progress')
        .select('completed')
        .eq('user_id', user.id)
        .eq('video_id', body.video_id)
        .maybeSingle()

      if (existing?.completed) {
        // Video already completed — update position but keep completed=true
        const { data, error } = await supabase
          .from('video_watch_progress')
          .update({
            watched_seconds: watchedSeconds,
            duration_seconds: durationSeconds,
            last_watched_at: now,
          })
          .eq('user_id', user.id)
          .eq('video_id', body.video_id)
          .select()
          .single()

        if (error) {
          console.error('[Watch Progress] Update failed:', error.message)
          return NextResponse.json({ error: formatDbError(error.message) }, { status: 500 })
        }
        return NextResponse.json(data)
      }
    }

    const { data, error } = await supabase
      .from('video_watch_progress')
      .upsert(
        {
          user_id: user.id,
          video_id: body.video_id,
          watched_seconds: watchedSeconds,
          duration_seconds: durationSeconds,
          completed,
          last_watched_at: now,
        },
        { onConflict: 'user_id,video_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[Watch Progress] Upsert failed:', error.message)
      return NextResponse.json({ error: formatDbError(error.message) }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Watch Progress] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function formatDbError(message: string): string {
  if (/relation.*does not exist/i.test(message)) {
    return 'Database table "video_watch_progress" not found — run the migration SQL'
  }
  if (/permission denied|policy/i.test(message)) {
    return 'Database permissions not configured — RLS policies may be missing'
  }
  if (/unique|duplicate|conflict/i.test(message)) {
    return 'Database constraint error — the unique constraint may be misconfigured'
  }
  if (/violates foreign key/i.test(message)) {
    return 'Video not found in database — try re-syncing from Vimeo'
  }
  return message
}

// ── GET — fetch watch progress for current user ─────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated — please log in again' },
        { status: 401 }
      )
    }

    const videoId = request.nextUrl.searchParams.get('video_id')

    let query = supabase
      .from('video_watch_progress')
      .select('*')
      .eq('user_id', user.id)

    if (videoId) {
      query = query.eq('video_id', videoId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Watch Progress] Query failed:', error.message)
      return NextResponse.json({ error: formatDbError(error.message) }, { status: 500 })
    }

    return NextResponse.json(videoId ? (data?.[0] || null) : data)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Watch Progress] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
